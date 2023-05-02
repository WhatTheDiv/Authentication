
require ('dotenv').config()
const Database = require ('nedb')
const express = require('express')
const bcrypt = require('bcrypt')
const path = require('path')
const jwt = require('jsonwebtoken')
const app = express()
const Db_Users = new Database({ filename:'Db_users.db', autoload:true })
const port = 3001
const ServerIp = '192.168.2.105'

                                //               CLIENT SERVER                //

app.use('/login', express.static( path.resolve(__dirname, '../login')))
app.use('/client', express.static (path.resolve(__dirname, '../client/build')))
app.use(express.json({limit:'10mb'}))
app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['http://'+ServerIp+':3000']);
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append('Access-Control-Allow-Headers', ['Content-Type','Access-Control-Allow-Credentials']);
  res.append('Access-Control-Allow-Credentials', 'true');
  next();
});

/* ===== Main Calls =====
- Serves homepage / login page
- Stores user data
- Registers new users ( Db_Users { Db_UserCreds.username, name, email, Db_UserCreds.userID } )
*/

app.get('/', middleware_validateLoginStatus, ( req, res ) => {
  if(req.user?._id) return res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
  else return res.sendFile(path.resolve(__dirname, '../login/HTML', 'login.html'))
})
app.get('/register',( req, res ) => {
  return res.sendFile(path.resolve(__dirname, '../login/HTML', 'register.html'))
})
app.post('/newUser', async ( req, res ) => { // registers new user and adds to database
  const userPrototype = req.body?.user
  if(!userPrototype || !userPrototype.name || !userPrototype.username || !userPrototype.email || !userPrototype.password )
    return res.status(400).json({message:'Missing required fields', sendback:userPrototype})

  if(await usernameExists(userPrototype.username)) return res.status(400).json({message:'Username already exists'})

  userPrototype.password = await bcrypt.hash(userPrototype.password,10)

  const newUserAddedSucessfully = await registerNewUser(userPrototype)
  console.log("newUserAddedSucessfully",newUserAddedSucessfully);

  if(newUserAddedSucessfully) return res.status(200).json({message:'Sucessfully added new user'})
  else return res.status(500).json({message:'Add new user Unsucessful'})
})
app.post('/getUserData', middleware_validateLoginStatus, async ( req, res ) => {
  function trimUserData(u){
    // console.log('original user data: ',u);
    return {
      name: u.name,
      email: u.email,
      username: u.username,
    }
  }
  function createDevUser(){
    return {
      name: 'DevUser',
      email: 'Dev@user.com',
      username: 'DevUsername1'
    }
  }
  const user = req.user
  if(user === null){
    const devUser = createDevUser()
    return res.status(500).json({message:"Server error finding user, running dev", dev:true, ...devUser})
  }
  else if(user === false) return res.status(400).json({message:"Could not find user"})
  return res.status(200).json(trimUserData(user))
})
app.post('/setUserData', middleware_validateLoginStatus, async ( req, res ) => {
  async function revertAuth(res,oldData,status,message) {
    if(!oldData.new.username)
      return res.status(status).json({message})
    else if(oldData.new.username && await auth_updateUserData(oldData))
      return res.status(500).json({message:"Server fail but revert sucessful, status:"+status+", err: "+message})
    else return res.status(500).json({message:"Server fail and revert fail!!!! database out of sync! status:"+status+", err: "+message}) 

  }
  // checks if newUserData has password
  // - update password with auth server before update
  // - revert changes if fail

  const newUserData = req.body
  const oldUserData = req.user
  const updateWithAuth = {
    id:oldUserData._id,
    new:{}
  }
  const inCaseOfRevert = {
    id:oldUserData._id,
    new:{}
  }
  console.log('before update: ',{oldUser:oldUserData, newUser:newUserData})

  if(newUserData.username || newUserData.password){
    if(newUserData.username && await usernameExists(newUserData.username)) 
      return res.status(400).json({message:"Username '"+newUserData.username+"' already exists"})
    if(newUserData.username){
      updateWithAuth.new.username = newUserData.username
      inCaseOfRevert.new.username = oldUserData.username
    }
    if(newUserData.password){
      updateWithAuth.new.password = await bcrypt.hash(newUserData.password,10)
      console.log('make sure password is encrypted',newUserData.password);
    }

    if(!await auth_updateUserData(updateWithAuth))
      return res.status(500).json({message:"Error updating user info on auth server"})
  }
  
  if(!newUserData.username && !newUserData.name && !newUserData.email) 
    return res.status(200).json({message:"User updated with auth Sucessfully"})
  
  
  Db_Users.update({_id:oldUserData._id},{$set:{...newUserData}}, {}, (err, numReplaced) => {
    if(err) return revertAuth(res,inCaseOfRevert,500,"Server error setting data for "+req.user.username)
    else if(numReplaced <= 0) return revertAuth(res,inCaseOfRevert,400,"User "+req.body.user.username+" does not exist")
    console.log('number of items replaced: ',numReplaced)

    Db_Users.find({_id:oldUserData._id}, (e,docs) => {
      if(e) return revertAuth(res,inCaseOfRevert,500,'Server error, something went wrong searching database ')
      else if(docs.length <= 0) return revertAuth(res,inCaseOfRevert,500,'Server error, Could not find user after update')
      console.log('after update: ',docs[0]);
      return res.status(200).json({message:"User updated sucessfully", user: {...docs[0]}})
    })
    
  })
})

/* ===== Functions =====
* middleware_validateLoginStatus() - async - validates access token then produces user ...       { user: user | null | false }
* extractTokens() - gets tokens from cookie and returns it in object form ...                    { SESH_ID: SESH_ID | null, REFRESH_ID: REFRESH_ID | null, }
* registerNewUser() - async -  registers new user and adds to database                           ( true | false )
* getUser_fromId() - async - searches database for user ...                                      { user: user | null | false }
* auth_updateAccessToken() - async - fetches auth to update access token ...                     { userId: id | null, newAccessToken: token | null }
* auth_createNewUser() - async - sends user prototype to auth server ...                         { username: username | null, userID: id | null }
*/

async function middleware_validateLoginStatus( req, res, next ) { // returns { req.user: user | false | null }
  function validateAccessToken(token){ // returns ( id | false )
    if(!token) return false
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err,payload) => {
      if(err) return false
      return payload
    })
  }
  async function getId(tokens,response){ // returns ( id | null | )
    return new Promise( async ( res, rej ) => {
      const idFromSession = tokens.SESH_ID ? validateAccessToken(tokens.SESH_ID) : null
      if(idFromSession) res(idFromSession.id)
      else if(tokens.REFRESH_ID){
        const idAndToken = await auth_updateAccessToken(tokens.REFRESH_ID)

        if(!idAndToken?.userId) rej('Could not create new access token')

        updateCookieWithNewAccessToken(response,idAndToken.newAccessToken)
        res(idAndToken.userId)
      }
      else if(!tokens.REFRESH_ID) rej("No access or refresh token available")
      else{
        throw new Error('Out of bounds')
      }
    }).then( res => {
      console.log('Found user id')
      return res
    }).catch( e => {
      console.log('getId -',e)
      return null
    })
  } 
  console.log('Checking login status');
  const id = await getId(extractTokens(req.headers.cookie,req.headers),res).catch( e => console.log(e))
  req.user = !id ? null : await getUser_fromId(id)
  next()
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
async function registerNewUser(safePrototype) { // returns ( true | false ) based on sucessful addition to database
  return new Promise( async (res, rej) => {
      // should not enter function without valid prototype 
    const Db_UserCreds_User = await auth_createNewUser({username: safePrototype.username, password: safePrototype.password}).catch( e => null)

    if(!Db_UserCreds_User || !Db_UserCreds_User.username || !Db_UserCreds_User.userID) return false
    
    const user = {
      username: Db_UserCreds_User.username,
      name:safePrototype.name,
      email:safePrototype.email,
      _id:Db_UserCreds_User.userID
    }

    Db_Users.insert(user, err => {
      if(err){
        console.log('Error saving new user: ',err)
        rej(false)
      }
      res(true)
    })
  })
}
async function getUser_fromId(id) { // returns { user: user | null | false }
  return new Promise(( res, rej ) => {
    return Db_Users.find({_id:id}, ( err, docs ) => {
      if(err){
        console.log('Error in getUser: ',err)
        res(null)
      }
      else if(docs.length <= 0){
        console.log('Could not find user with id: ',id)
        res(false)
      }
      else{
        res(docs[0])
      }
    })
  })
}
function updateCookieWithNewAccessToken(response,token){
  response.set({'Set-Cookie':"SESH_ID="+token+"; path=http://"+ServerIp})
}
async function auth_updateAccessToken(refreshToken) { // returns { userId: id | null, newAccessToken: token | null }
  try {
    const options = {
      headers:{
        "Content-Type":"application/json",
        "authorization": ["Bearer "+refreshToken]
      },
      credentials:'include',
      method:'POST',
      body:JSON.stringify({token:refreshToken})
    }
    const fetchRequest = new Request('http://'+ServerIp+':4001/updateAccessToken')
    const res = await fetch(fetchRequest,options)
    const data = await res.json()
    if(!res.ok) throw new Error('Auth server responded with code ('+ res.status +'): '+data.message)
    return {
      userId:data.userID,
      newAccessToken:data.newAccessToken,
    }
  } catch (error) {
    console.log('Failed to update access token: ',error)
    return {
      userId: null,
      newAccessToken: null
    }
  }
    
}
async function auth_createNewUser(prototype) { // returns { username: username | null, userID: id | null }
  try {
    const options = {
      headers:{
        "Content-Type":"application/json"
      },
      method:'POST',
      body:JSON.stringify({prototype})
    }
    const fetchRequest = new Request('http://'+ServerIp+':4001/createNewUser')
    const res = await fetch(fetchRequest,options)
    const data = await res.json()
    if(!res.ok) throw new Error('Auth server responded with code ('+ res.status +'): '+data.message)
    return {
      username:data.username,
      userID:data.userID
    }
  } catch (error) {
    console.log('Failed to create new user: ',error.message)
    return {
      username: null,
      userID: null
    }
  }
}
async function auth_updateUserData(newUserData) { // returns { updateSuccess: true | false, message}
  
  try {
    const options = {
      headers:{
        "Content-Type":"application/json",
      },
      method:'POST',
      body:JSON.stringify({newUserData})
    }
    const fetchRequest = new Request('http://'+ServerIp+':4001/updateUser')
    const res = await fetch(fetchRequest,options)
    const data = await res.json()
    if(!res.ok){
      console.log('Auth server responded with code ('+ res.status +'): '+data.message)
      return false
    }
    return true
  } catch (error) {
    console.log('Error contacting auth server to update user: ',error.message)
    return false
  }
}
async function usernameExists(username) {
  return new Promise(( res,rej ) => {
    Db_Users.find({username}, (err,docs) => {
      if(err || docs.length >= 1) res(true)
      res(false)
    })
  })
}



// old Main
// app.get('/',middleware_checkLoggedIn, (req,res) => {
//   console.log('req.isLoggedIn:',req.isLoggedIn)
//   if(req.isLoggedIn) return res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
//   else if(!req.isLoggedIn) return res.sendFile(path.resolve(__dirname, '../login/HTML', 'login.html'))
// })
// app.get('/register',(req,res) => {
//   return res.sendFile(path.resolve(__dirname, '../login/HTML', 'register.html'))
// })
// app.post('/getUserData', populateCallWithUserContent, (req,res) => {
//   console.log('good user data: ',req.user);
//   res.json({
//     name:req.user.name,
//     username:req.user.username
//   })
// })

// old functions
// async function middleware_checkLoggedIn( req, res, next ){
//   const tokens = findTokensInCookie(req.headers.cookie)
//   if(checkLoggedIn(tokens.SESH_ID)){
//     req.isLoggedIn = true
//     next()
//   }
//   else if(!tokens.REFRESH_ID){
//     console.log('No refresh or session tokens');
//     req.isLoggedIn = false 
//     next()
//   }
//   else if(await checkRefreshToken(tokens.REFRESH_ID)){
//     try {
//       const options = {
//         headers:{
//           "Content-Type":"application/json"
//         },
//         method:'POST',
//         body:JSON.stringify({token:tokens.REFRESH_ID})
//       }
//       const fetchRequest = new Request('http://'+ServerIp+':4001/getNewAccessToken')
//       const response = await fetch(fetchRequest,options)
//       const data = await response.json()
//       if(!response.ok) throw new Error('Bad getNewAccessToken fetch: '+data.message)

//       const user = getUserFromAccessToken(data.token)
//       console.log('New access token created by [',user.username,']')

//       req.isLoggedIn = true
//       res.set({'Set-Cookie':"SESH_ID="+data.token+"; path=http://ServerIp"})
//       next()

//     } catch (err) {
//       console.log('Failed to use refresh token: ',err.message)
//       req.isLoggedIn = false 
//       next()
//     }

//   }
//   else{
//     console.log('Refresh token invalid, deleting')
//     res.set({
//       'Set-Cookie':"SESH_ID=; expires="+new Date()+"; path=http://"+ServerIp,
//       'Set-Cookie':"REFRESH_ID=; expires="+new Date()+"; path=http://"+ServerIp
//     })
//     req.isLoggedIn = false 
//     next()
//   }
// }
// async function populateCallWithUserContent( req, res, next ){
//   function generateNewAccessToken(refreshToken){ // return access token

//   }
//   const tokens = findTokensInCookie(req.headers.cookie)
//   if(!tokens.SESH_ID) return res.status(401).json({message:'No token given at homepage'})

//   let user = getUserFromAccessToken(tokens.SESH_ID)
//   if(user === null){
//     // access token may be expired, check refresh ************************************
//     if(await checkRefreshToken(tokens.REFRESH_ID)){
//       // get new access token here
//       const newAccessToken = generateNewAccessToken(tokens.REFRESH_ID)
//     }
//     else return res.status(401).redirect('/')
//   }
//   console.log('goin in with user: ',user)
//   try {
//     const options = {
//       headers:{
//         "Content-Type":"application/json"
//       },
//       method:'POST',
//       body:JSON.stringify({username:user.username})
//     }
//     const fetchRequest = new Request('http://'+ServerIp+':4001/getUser')
//     const response = await fetch(fetchRequest,options)
//     const data = await response.json()
//     if(!response.ok) throw new Error('Bad getUser fetch: '+response.message)
//     if(!data.user) res.status(500).json({message:'Server error finding user'})

//     req.user = data.user 
//     next()

//   } catch (err) {
//     console.log('*** Server Error ***')
//     console.log(err.message)
//     res.status(500).json({message:'Server error finding user2'});
//   }

  
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
// function checkLoggedIn(token){
//   if(!token) return false 
//   return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
//     if(err) return false 
//     return true
//   })
// }
// async function checkRefreshToken(token){
//   if(!token){
//     console.log('No token given');
//     return false;
//   }
//   return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
//     if(err){
//       console.log('Imposter refresh token');
//       return false 
//     }
//     console.log('Refresh token derived from secret, checking for it in database.');

//     try {
//       const options = {
//         headers:{
//           "Content-Type":"application/json"
//         },
//         method:'POST',
//         body:JSON.stringify({token})
//       }
//       const fetchRequest = new Request('http://'+ServerIp+':4001/validateRefreshTokenInDatabase')
//       const response = await fetch(fetchRequest,options)
//       const data = await response.json() 
//       console.log(data.message)
//       if(!response.ok) return false
//       return true
//     } catch (error) {
//       console.log(' Server error checking for refresh token validity: ',error.message)      
//       return false
//     }
//   })
// }
// function getUserFromAccessToken(accessToken){
//   return jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, shallowUser_safe) => {
//     if(err) {
//       console.log('err in verify: ',err.message)
//       return null
//     }
//     else if(shallowUser_safe === undefined) return null
//     else return shallowUser_safe
//   })
// }



app.listen( port , () => console.log(`Client server listening on port ${port}`))