
require ('dotenv').config()
const express = require('express')
const app = express()
const port = 4001
const path = require('path')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const Database = require ('nedb')
const users = new Database({ filename:'users.db', autoload:true }) 
const Db_Users = new Database({ filename:'Db_users.db', autoload:true })
const Db_RefreshTokens = new Database({ filename:'Db_refreshTokens.db', autoload:true })
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

// Main

app.post('/createNewUser',  async (req,res) => {
  console.log('Creating new user ...')
  try {
    if ( !req.body.username || !req.body.password || !req.body.name || !req.body.email) 
      return res.status(400).json({message:'Missing / invalid field'})
    else if ( await findUser_fromUsername(req.body.username) ){
      console.log(' *** (',req.body.username,') Username already exists.')
      return res.status(409).json({message:'Username already taken'})
    }
    
    const username = req.body.username 
    const password = await bcrypt.hash(req.body.password,10)
    const name = req.body.name
    const email = req.body.email
    const user = {
      name,
      username,
      password 
    }
  
    Db_Users.insert(user, (err,item) =>{
      if(err) throw new Error('Error inserting user into database')
      
      // if success
      console.log('Created new user: ',user)

      return res.status(201).end()
      // res.redirect(302,'/login/HTML/login.js')
    })
  } catch (err) {
    // if any errors
    console.error('Error while creating new user: ',err)
    return res.status(500).json({message:'OOPS! Server error'})
  }
})
app.post('/loginUser', async (req,res) => {
 try {
  if( !req.body.username || !req.body.password ) return res.status(400).json({message:'Missing username / password'})
  const shallowUser_unsafe = {
    username:req.body.username,
    password:req.body.password
  }
  const existingUser = await findUser_fromUsername(shallowUser_unsafe.username)
  
  if(!existingUser) return res.status(404).json({message:'Username / Password not found'})
  else if(!await bcrypt.compare( shallowUser_unsafe.password, existingUser.password )) return res.status(404).json({message:'Username / Password not found'})

  // username password check passed -

  const accessToken = generateAccessToken({ username: existingUser.username, password: existingUser.password })
  const refreshToken = jwt.sign({ username: existingUser.username, password: existingUser.password }, process.env.REFRESH_TOKEN_SECRET)
  
  Db_RefreshTokens.insert({ token: refreshToken }, (err,item) => { 
    if(err) throw new Error('Error inserting refresh token')
    console.log(' *** Sucessfully logged in ',existingUser.username)

    return res.status(200,'').json({ accessToken, refreshToken })
  })

 } catch (err) {
  console.error('Error logging in user:',err)
  return res.status(500).json({message:'OOPS! Server error'})
 }
})
app.post('/getUser', (req,res) => {
  // add some middleware to validate server
  findUser_fromUsername(req.body.username).then( result => {
    return res.json({user:result, error:null})
  }).catch( e => {
    return res.json({user:null, error:'Could not retrieve that user'})
  })
})
app.post('/getNewAccessToken', (req,res) => {
  try {
    const refreshToken = req.body.token
    if (!refreshToken) return res.sendStatus(401)

    Db_RefreshTokens.find({ token: refreshToken }, (err, docs) => {
      if (err) throw new Error('Error finding refresh token')
      else if(docs.length <= 0) return res.status(401).json({message:'Invalid / Expired token'})

      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, shallowUser_safe) => {
        if(err) throw new Error('Error verifying refresh token')
        if(shallowUser_safe === undefined) return res.status(401).json({message:'Could not find user'})

        res.json({token:generateAccessToken({username:shallowUser_safe.username, password:shallowUser_safe.password})})
      })
    })
  } catch (err) {
    console.error('Could not grant new access token', err)
    return res.status(500).json({message:'Imposter token!'})
  }
})
app.post('/validateRefreshTokenInDatabase', (req,res) => {
  const token = req.body.token 
  Db_RefreshTokens.find({ token },( err, docs ) => {
    if(err) return res.status(500).json({message:'Server error finding token in db'})
    else if(docs.length <= 0) return res.status(401).json({message:'Refresh token not in database'})
    
    return res.status(200).json({message:'Refresh token available in database'})
  })
  
})
app.delete('/logoutUser', bodyParser.urlencoded({extended:false}), (req,res) => {
  try {
    if(!req.body.token) throw new Error('No token given to logout')
    Db_RefreshTokens.delete({token:req.body.token}, (err,numberOfRemovedItems) => {
      if(err) throw new Error('Error removing refresh token')
      res.sendStatus(200)
    })
  } catch (err) {
    console.error('Error logging out! ',err)
    res.sendStatus(500)
  }
})

// Model

app.delete('/logout', (req,res) => {      /*         DELETE REFRESH TOKEN          */
  // deletes refresh token from database
  Db_RefreshTokens.delete({token:req.body.token}, (e,numRm => {
  // Db_RefreshTokens = Db_RefreshTokens.filter( token => token !== req.body.token)
    if(e) console.log('error removing refresh token!!!',e)
  }))

  // send success
  res.sendStatus(204)
})
app.post('/token', (req,res) => {         /*         REFRESH TOKEN                 */ 
  // assign refreshtoken sent in fetch to varaible
  const refreshToken = req.body.token

  // verify token was sent with request and token is in Db_RefreshTokens array
  if(refreshToken == null) return res.sendStatus(401) 

  // if(!Db_RefreshTokens includes(refreshToken)) return res.sendStatus(403)
  Db_RefreshTokens.find({token:refreshToken}, (err,item) => {
    if(err) res.sendStatus(401)

    // verify refreshToken came from server private key  
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
      if(err) return res.sendStatus(403)

      // create a new access token with current user
      const accessToken = generateAccessToken({ name: user.name, password: user.password })

      // send success
      res.json({ accessToken })
    })
  })

  
})
app.post('/login', (req,res) => {         /*         LOGS IN USER                  */
  // finds user in user array that has matching name
  users.find({name:req.body.name},async (err,item) => {
    // if no user found, reject
    if(err || item.length <= 0) return res.sendStatus(400)

    const user = item[0]

    try {
      // compare password provided to password stored in user
      if(await bcrypt.compare(req.body.password, user.password)){
  
        // * if good password * generates an access token from user
        const accessToken = generateAccessToken({ name: user.name, password:user.password })
  
        // generates a refresh token
        const refreshToken = jwt.sign({name:user.name, password:user.password}, process.env.REFRESH_TOKEN_SECRET)
  
        // adds new refreshToken to Db_RefreshTokens array
        Db_RefreshTokens.insert({token:refreshToken}, (err, item) => {
          if(err) console.log('ERROR saving refresh token to database')
          res.json({ accessToken, refreshToken })
        })
  
        // if success, passes access token and refresh token to user
      } else {
  
        // if error, rejects request
        res.sendStatus(401)
      }
    } catch (error) {
      res.sendStatus(500)
    }
  })
})
app.post('/users', async (req,res) => {   /*         CREATES, STORES NEW USER      */
  try {
    // create hashed password 
    const hashedPassword = await bcrypt.hash(req.body.password,10)

    // create user with hashed password
    const user = {
      name: req.body.name,
      password: hashedPassword
    }
    
    // push user to user array
    users.insert(user, (err,item) => {
      if(err) res.sendStatus(500)
      console.log('stored new user: ',item)

      // if success, send success
      res.sendStatus(201)
    })

    

  } catch (error) {
    // if error, send fail
    res.sendStatus(500)
  }
})

// Testing

app.get('/docs', (req,res) => {
  // responds with full user list
  const arr = []
  users.find({}, (err,docs) => {
    docs.forEach(item => {
      arr.push(item)
    });
    res.json(arr)
  })
  
})
app.post('/addToDb', (req,res) => {
  // adds random number to database
  const number = Number((Math.random() * 100).toFixed(0))
  users.insert({number},( err, item ) => {
    if(err) console.log('Error in addToDb: ',err);
    res.json({item})
  })
  
})

// Functions 

async function findUser_fromUsername( username ) {
  return new Promise((res,rej) => {
    Db_Users.find({username}, (err,docs) => {
      if(err) rej(new Error('Bad username given'))
      else if(docs.length === 0) res(false)
      else if(docs.length >= 1) res(docs[0])
    })
  })
  
}
function generateAccessToken(user) {
  // takes { name, password } from user and generates access token
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '20s' })
}


app.listen( port , () => console.log(`Authentication server listening on port ${port}`))