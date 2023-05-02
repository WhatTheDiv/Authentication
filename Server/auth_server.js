
require ('dotenv').config()
const express = require('express')
const app = express()
const port = 4001
const path = require('path')
// const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const Database = require ('nedb')
const Db_UserCreds = new Database({ filename:'Db_userCreds.db', autoload:true })
// const Db_RefreshTokens = new Database({ filename:'Db_refreshTokens.db', autoload:true })
const ServerIp = '192.168.2.105'


                                //               AUTHENTICATION SERVER                // 

app.use(express.json({limit:'20mb'}))
app.use('/login', express.static( path.resolve(__dirname, '../login')))
app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['http://'+ServerIp+':3001']);
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append('Access-Control-Allow-Headers', ['Content-Type','Access-Control-Allow-Credentials']);
  res.append('Access-Control-Allow-Credentials', 'true');
  next();
});

/* ===== Main Calls =====
  - create new user ( Db_UserCreds { username, password, refreshToken, userID } )
  - login user 
  - log out user 
  - get new access token 
  - validateRefreshToken
*/
app.post('/createNewUser', async ( req, res ) => { // returns json( message | { username: username | null, userID: id | null  })
  const prototype = req.body.prototype
  if(!prototype.username || !prototype.password) return res.status(400).json({message:"Request did not include username and password"})
  prototype.refreshToken = null
  Db_UserCreds.find({username:prototype.username}, ( err, docs ) => {
    if(err) return res.status(500).json({message:"Error occured when searching database for duplicates"})
    else if(docs.length >= 1) return res.status(400).json({message:"User exists with that username"})

    Db_UserCreds.insert({...prototype}, ( err, newDoc ) => {
      if(err) return res.status(500).json({message:"Error occured when adding user to database"})
      return res.status(200).json({username:newDoc.username, userID:newDoc._id, message:"Sucessfully created new user in auth "})
    })
  })
})
app.post('/login', ( req, res ) => { // returns json({ message, SESH_ID, REFRESH_ID })
  if( !req.body.username || !req.body.password ) return res.status(400).json({message:'Enter username and password'})
  const client_credentials = {
    username: req.body.username,
    password: req.body.password
  }
  Db_UserCreds.find({username:client_credentials.username}, async ( err, docs ) => {
    if(err) return res.status(500).json({message:"Server error finding username in database"})
    else if(docs.length <= 0) return res.status(400).json({message:"Invalid username"})
    const existingUser = docs[0]
    if(!await bcrypt.compare(client_credentials.password, existingUser.password).catch( e => false)) return res.status(400).json({message:"Invalid password"})

    
    const newAccessToken = generateAccessToken(existingUser._id)
    const newRefreshToken = generateRefreshToken(existingUser._id)

    Db_UserCreds.update({username:client_credentials.username},{ $set: { refreshToken:newRefreshToken }}, {}, ( error,numOfUpdated ) => {
      if(error || numOfUpdated <= 0) return res.status(500).json({message:"Server error updaing refresh token in user in database"})
      updateCookieWithNewAccessTokens(res,{ newAccessToken, newRefreshToken })
      console.log('logging in ',existingUser.username);
      return res.status(200).json({message:"Sucessfully logged in "+existingUser.username})
    })
  })

})
app.delete('/logout', ( req, res ) => { // returns json({ message })
  try {
    const token = extractTokens(req.headers.cookie,req.headers).REFRESH_ID
    if(!token) throw new Error("No token given")
    Db_UserCreds.update({refreshToken:token}, {$set: {refreshToken:null}}, {}, ( err, numberOfReplaced ) => {
      if(err) throw new Error("Server error finding user")
      else if(numberOfReplaced.length <= 0) throw new Error("No users have this token")
      console.log('Sucessfully logged out')
      res.status(200).json({message:"User sucessfully logged out"})
    })
  } catch (err) {
    console.error('Error logging out! ',err.message)
    res.status(500).json({message:err.message})
  }
})
app.post('/updateAccessToken', ( req, res ) => { // returns json({ userId: id | null, newAccessToken: token | null, message: message | null})
  const refreshToken = req.headers['authorization'].split(' ')[1]
  let status = 200;
  try {
    if(!refreshToken){
      status(400)
      throw new Error("No refresh token given")
    }
    Db_UserCreds.find({ refreshToken }, ( err, docs ) => {
      if(err){
        return res.status(status).json({ userID:null, newAccessToken:null, message:"Server error finding token" })
      }
      else if(docs.length <= 0){
        return res.status(status).json({ userID:null, newAccessToken:null, message:"Not a valid refresh token" })
      }
      console.log('updating access token for user',docs[0].username);
      const userID = docs[0]._id
      const newAccessToken = generateAccessToken(userID)
      res.status(200).json({ userID, newAccessToken, message:"Sucessful creation of new access token" })
    })
  } catch (error) {
    console.log("Could not update access token: ",error.message)
    res.status(status).json({ userID:null, newAccessToken:null, message:error.message })
  }
})
app.post('/updateUser', async (req,res) => {
  const newData = req.body?.newUserData.new 
  const id = req.body?.newUserData.id

  if( !newData || !id || (!newData.username && !newData.password) ) return res.status(400).json({message:"Did not provide essential info"})

  if(await updateUser_id(id,{...newData})) 
    return res.status(200).json({message:"sucessfully updated user with auth"})
  else return res.status(500).json({message:"auth could not update user "})
})


/* ===== Auth Functions =====
* generateAccessTokens() - creates new access token                                              ( token )
* setAllowOrigin() - checks headers for origin and if on list, allows                            

===== Client Functions =====
* middleware_validateLoginStatus() - async - validates access token then produces user ...       { user: user | null | false }
* extractTokens() - gets tokens from cookie and returns it in object form ...                    { SESH_ID: SESH_ID | null, REFRESH_ID: REFRESH_ID | null, }
* registerNewUser() - async -  registers new user and adds to database                           ( true | false )
* getUser_fromId() - async - searches database for user ...                                      { user: user | null | false }
* auth_updateAccessToken() - async - fetches auth to update access token ...                     { userId: id | null, newAccessToken: token | null }
*/

function generateAccessToken(id) { // returns ( token )
  return jwt.sign({id}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '20s' })
}
function generateRefreshToken(id) { // returns ( token )
  return jwt.sign({id}, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' })
}
function updateCookieWithNewAccessTokens(response,tokens){
  if(tokens.newAccessToken) response.cookie("SESH_ID="+tokens.newAccessToken+"; path=http://"+ServerIp)
  if(tokens.newRefreshToken) response.cookie("REFRESH_ID="+tokens.newRefreshToken+"; path=http://"+ServerIp)
}
function extractTokens(cookie,headers) { // returns { SESH_ID: SESH_ID | null, REFRESH_ID: REFRESH_ID | null, }
  // console.log('are auth headers valid?  ... ',headers)
  // console.log('getting cookie: ',cookie);
  let SESH_ID, REFRESH_ID = null
  if(!cookie)return {SESH_ID, REFRESH_ID}
  const string = cookie.toString()

  const indexOfSeshId_start = string.indexOf("SESH_ID") === -1 ? -1 : string.indexOf('=', string.indexOf("SESH_ID")) + 1
  if (indexOfSeshId_start === -1) SESH_ID = null
  else {
    const indexOfRefreshId_end = string.indexOf(';', indexOfSeshId_start) === -1 ? undefined : string.indexOf(';', indexOfSeshId_start)
    SESH_ID = string.slice(indexOfSeshId_start, indexOfRefreshId_end)
  }
  const indexOfRefreshId_start = string.indexOf("REFRESH_ID") === -1 ? -1 : string.indexOf('=', string.indexOf("REFRESH_ID")) + 1
  if (indexOfRefreshId_start === -1) REFRESH_ID = null
  else {
    const indexOfRefreshId_end = string.indexOf(';', indexOfRefreshId_start) === -1 ? undefined : string.indexOf(';', indexOfRefreshId_start)
    REFRESH_ID = string.slice(indexOfRefreshId_start, indexOfRefreshId_end)
  }

  if(SESH_ID === 'undefined') SESH_ID = null 
  if(REFRESH_ID === 'undefined') REFRESH_ID = null

  return {
    SESH_ID,
    REFRESH_ID
  }
}
async function updateUser_id(_id,newData) {
  return new Promise(( res, rej ) => {
    Db_UserCreds.update({_id},{$set:{...newData}}, {}, ( err, numOfUpdated ) => {
      if(err || numOfUpdated <= 0) res(false)
      res(true)
    })
  })
}


// old Main

// app.post('/createNewUser',  async (req,res) => {
//   console.log('Creating new user ...')
//   try {
//     if ( !req.body.username || !req.body.password || !req.body.name || !req.body.email) 
//       return res.status(400).json({message:'Missing / invalid field'})
//     else if ( await findUser_fromUsername(req.body.username) ){
//       console.log(' *** (',req.body.username,') Username already exists.')
//       return res.status(409).json({message:'Username already taken'})
//     }
    
//     const username = req.body.username 
//     const password = await bcrypt.hash(req.body.password,10)
//     const name = req.body.name
//     const email = req.body.email
//     const user = {
//       name,
//       username,
//       password 
//     }
  
//     Db_Users.insert(user, (err,item) =>{
//       if(err) throw new Error('Error inserting user into database')
      
//       // if success
//       console.log('Created new user: ',user)

//       return res.status(201).end()
//       // res.redirect(302,'/login/HTML/login.js')
//     })
//   } catch (err) {
//     // if any errors
//     console.error('Error while creating new user: ',err)
//     return res.status(500).json({message:'OOPS! Server error'})
//   }
// })
// app.post('/loginUser', async (req,res) => {
//  try {
//   if( !req.body.username || !req.body.password ) return res.status(400).json({message:'Missing username / password'})
//   const shallowUser_unsafe = {
//     username:req.body.username,
//     password:req.body.password
//   }
//   const existingUser = await findUser_fromUsername(shallowUser_unsafe.username)
  
//   if(!existingUser) return res.status(404).json({message:'Username / Password not found'})
//   else if(!await bcrypt.compare( shallowUser_unsafe.password, existingUser.password )) return res.status(404).json({message:'Username / Password not found'})

//   // username password check passed -

//   const accessToken = generateAccessToken({ username: existingUser.username, password: existingUser.password })
//   const refreshToken = jwt.sign({ username: existingUser.username, password: existingUser.password }, process.env.REFRESH_TOKEN_SECRET)
  
//   Db_RefreshTokens.insert({ token: refreshToken }, (err,item) => { 
//     if(err) throw new Error('Error inserting refresh token')
//     console.log(' *** Sucessfully logged in ',existingUser.username)

//     return res.status(200,'').json({ accessToken, refreshToken })
//   })

//  } catch (err) {
//   console.error('Error logging in user:',err)
//   return res.status(500).json({message:'OOPS! Server error'})
//  }
// })
// app.post('/getUser', (req,res) => {
//   // add some middleware to validate server
//   if(!req.body.username) return res.status(400).json({message:'get user request did not provide username'})
//   findUser_fromUsername(req.body.username).then( result => {
//     return res.json({user:result, error:null})
//   }).catch( e => {
//     return res.json({user:null, error:'Could not retrieve that user'})
//   })
// })
// app.post('/getNewAccessToken', (req,res) => {
//   try {
//     const refreshToken = req.body.token
//     if (!refreshToken) return res.sendStatus(401)

//     Db_RefreshTokens.find({ token: refreshToken }, (err, docs) => {
//       if (err) throw new Error('Error finding refresh token')
//       else if(docs.length <= 0) return res.status(401).json({message:'Invalid / Expired token'})

//       jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, shallowUser_safe) => {
//         if(err) throw new Error('Error verifying refresh token')
//         if(shallowUser_safe === undefined) return res.status(401).json({message:'Could not find user'})

//         res.json({token:generateAccessToken({username:shallowUser_safe.username, password:shallowUser_safe.password})})
//       })
//     })
//   } catch (err) {
//     console.error('Could not grant new access token', err)
//     return res.status(500).json({message:'Imposter token!'})
//   }
// })
// app.post('/validateRefreshTokenInDatabase', (req,res) => {
//   const token = req.body.token 
//   Db_RefreshTokens.find({ token },( err, docs ) => {
//     if(err) return res.status(500).json({message:'Server error finding token in db'})
//     else if(docs.length <= 0) return res.status(401).json({message:'Refresh token not in database'})
    
//     return res.status(200).json({message:'Refresh token available in database'})
//   })
  
// })
// app.delete('/logoutUser', bodyParser.urlencoded({extended:false}), (req,res) => {
//   const token = findTokensInCookie(req.headers.cookie).REFRESH_ID
//   try {
//     if(!token) throw new Error('No token given to logout')
//     Db_RefreshTokens.remove({token}, (err,numberOfRemovedItems) => {
//       if(err) throw new Error('Error removing refresh token')
//       res.status(200).json({message:'Deleted refresh token sucessfully'})
//     })
//   } catch (err) {
//     console.error('Error logging out! ',err)
//     res.status(500).json({message:err.message})
//   }
// })

// // old Functions 

// async function findUser_fromUsername( username ) {
//   return new Promise((res,rej) => {
//     Db_Users.find({username}, (err,docs) => {
//       if(err) rej(new Error('Bad username given'))
//       else if(docs.length === 0) res(false)
//       else if(docs.length >= 1) res(docs[0])
//     })
//   })
  
// }
// function generateAccessToken(user) {
//   // takes { name, password } from user and generates access token
//   return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '20s' })
// }
// function findTokensInCookie(cookies,request={SESH_ID:true, REFRESH_ID:true}){
//   let SESH_ID, REFRESH_ID = null
//   if(!cookies)return {SESH_ID, REFRESH_ID}
//   const string = cookies.toString()


//   if(request.SESH_ID){
//     const indexOfSeshId_start = string.indexOf("SESH_ID") === -1 ? -1 : string.indexOf('=',string.indexOf("SESH_ID"))+1
//     if(indexOfSeshId_start === -1) SESH_ID = null
//     else{
//       const indexOfRefreshId_end = string.indexOf(';',indexOfSeshId_start) === -1 ? undefined : string.indexOf(';',indexOfSeshId_start)
//       SESH_ID = string.slice(indexOfSeshId_start,indexOfRefreshId_end)
//     }
//   }
//   if(request.REFRESH_ID){
//     const indexOfRefreshId_start = string.indexOf("REFRESH_ID") === -1 ? -1 : string.indexOf('=',string.indexOf("REFRESH_ID"))+1
//     if(indexOfRefreshId_start === -1) REFRESH_ID = null
//     else{
//       const indexOfRefreshId_end = string.indexOf(';',indexOfRefreshId_start) === -1 ? undefined : string.indexOf(';',indexOfRefreshId_start)
//       REFRESH_ID = string.slice(indexOfRefreshId_start,indexOfRefreshId_end)
//     }
//   }
//   // console.log('found tokens: ',{SESH_ID,REFRESH_ID})
//   return {
//     SESH_ID,
//     REFRESH_ID
//   }
// }


// // Model

// app.delete('/logout', (req,res) => {      /*         DELETE REFRESH TOKEN          */
//   // deletes refresh token from database
//   Db_RefreshTokens.delete({token:req.body.token}, (e,numRm => {
//   // Db_RefreshTokens = Db_RefreshTokens.filter( token => token !== req.body.token)
//     if(e) console.log('error removing refresh token!!!',e)
//   }))

//   // send success
//   res.sendStatus(204)
// })
// app.post('/token', (req,res) => {         /*         REFRESH TOKEN                 */ 
//   // assign refreshtoken sent in fetch to varaible
//   const refreshToken = req.body.token

//   // verify token was sent with request and token is in Db_RefreshTokens array
//   if(refreshToken == null) return res.sendStatus(401) 

//   // if(!Db_RefreshTokens includes(refreshToken)) return res.sendStatus(403)
//   Db_RefreshTokens.find({token:refreshToken}, (err,item) => {
//     if(err) res.sendStatus(401)

//     // verify refreshToken came from server private key  
//     jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
//       if(err) return res.sendStatus(403)

//       // create a new access token with current user
//       const accessToken = generateAccessToken({ name: user.name, password: user.password })

//       // send success
//       res.json({ accessToken })
//     })
//   })

  
// })
// app.post('/login', (req,res) => {         /*         LOGS IN USER                  */
//   // finds user in user array that has matching name
//   users.find({name:req.body.name},async (err,item) => {
//     // if no user found, reject
//     if(err || item.length <= 0) return res.sendStatus(400)

//     const user = item[0]

//     try {
//       // compare password provided to password stored in user
//       if(await bcrypt.compare(req.body.password, user.password)){
  
//         // * if good password * generates an access token from user
//         const accessToken = generateAccessToken({ name: user.name, password:user.password })
  
//         // generates a refresh token
//         const refreshToken = jwt.sign({name:user.name, password:user.password}, process.env.REFRESH_TOKEN_SECRET)
  
//         // adds new refreshToken to Db_RefreshTokens array
//         Db_RefreshTokens.insert({token:refreshToken}, (err, item) => {
//           if(err) console.log('ERROR saving refresh token to database')
//           res.json({ accessToken, refreshToken })
//         })
  
//         // if success, passes access token and refresh token to user
//       } else {
  
//         // if error, rejects request
//         res.sendStatus(401)
//       }
//     } catch (error) {
//       res.sendStatus(500)
//     }
//   })
// })
// app.post('/users', async (req,res) => {   /*         CREATES, STORES NEW USER      */
//   try {
//     // create hashed password 
//     const hashedPassword = await bcrypt.hash(req.body.password,10)

//     // create user with hashed password
//     const user = {
//       name: req.body.name,
//       password: hashedPassword
//     }
    
//     // push user to user array
//     users.insert(user, (err,item) => {
//       if(err) res.sendStatus(500)
//       console.log('stored new user: ',item)

//       // if success, send success
//       res.sendStatus(201)
//     })

    

//   } catch (error) {
//     // if error, send fail
//     res.sendStatus(500)
//   }
// })

app.listen( port , () => console.log(`Authentication server listening on port ${port}`))