
require ('dotenv').config()
const express = require('express')
const app = express()
const port = 3001
const path = require('path')
const jwt = require('jsonwebtoken')
const ServerIp = '192.168.2.105'


const posts = [
  {
    username: 'Pat',
    title: 'Post 1'
  },
  {
    username: 'Kyle',
    title: 'Post 2'
  }
]

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

app.get('/',middleware_checkLoggedIn, (req,res) => {
  console.log('req.isLoggedIn:',req.isLoggedIn)
  if(req.isLoggedIn) return res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
  else if(!req.isLoggedIn) return res.sendFile(path.resolve(__dirname, '../login/HTML', 'login.html'))
})
app.get('/register',(req,res) => {
  return res.sendFile(path.resolve(__dirname, '../login/HTML', 'register.html'))
})
app.get('/getUserData', populateCallWithUserContent, (req,res) => {
  res.json({
    name:req.user.name,
    username:req.user.username
  })
})

function authenticateToken( req, res, next ){
  // requires authHeader = 'Bearer <token>'
  const authHeader = req.headers['authorization']
  console.log('authHeader: ',authHeader)
  const token = authHeader && authHeader.split(' ')[1]
  if(!token) return res.sendStatus(401)
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if(err) return res.sendStatus(403)

    req.user = user 
    next()
  })
}
async function middleware_checkLoggedIn( req, res, next ){
  const tokens = findTokensInCookie(req.headers.cookie)
  if(checkLoggedIn(tokens.SESH_ID)){
    req.isLoggedIn = true
    next()
  }
  else if(await checkRefreshToken(tokens.REFRESH_ID)){
    try {
      const options = {
        headers:{
          "Content-Type":"application/json"
        },
        method:'POST',
        body:JSON.stringify({token:tokens.REFRESH_ID})
      }
      const fetchRequest = new Request('http://'+ServerIp+':4001/getNewAccessToken')
      const response = await fetch(fetchRequest,options)
      const data = await response.json()
      if(!response.ok) throw new Error('Bad getNewAccessToken fetch: '+data.message)

      const user = getUserFromAccessToken(data.token)
      console.log('New access token created by [',user.username,']')

      req.isLoggedIn = true
      res.set({'Set-Cookie':"SESH_ID="+data.token+"; path=http://ServerIp"})
      next()

    } catch (err) {
      console.log('Failed to use refresh token: ',err.message)
      req.isLoggedIn = false 
      next()
    }

  }
  else{
    req.isLoggedIn = false 
    next()
  }
}
async function populateCallWithUserContent( req, res, next ){
  const tokens = findTokensInCookie(req.headers.cookie)
  if(!tokens.SESH_ID) return res.status(401).json({message:'No token given at homepage'})

  const user = getUserFromAccessToken(tokens.SESH_ID)
  if(user === null) return res.status(401).redirect('/')

  try {
    const options = {
      headers:{
        "Content-Type":"application/json"
      },
      method:'POST',
      body:JSON.stringify({username:user.username})
    }
    const fetchRequest = new Request('http://'+ServerIp+':4001/getUser')
    const response = await fetch(fetchRequest,options)
    const data = await response.json()
    if(!response.ok) throw new Error('Bad getUser fetch: '+response.message)
    if(!data.user) res.status(500).json({message:'Server error finding user'})

    req.user = data.user 
    next()

  } catch (err) {
    console.log('*** Server Error ***')
    console.log(err.message)
    res.sendStatus(500);
  }

  
}
function findTokensInCookie(cookies,request={SESH_ID:true, REFRESH_ID:true}){
  let SESH_ID, REFRESH_ID = null
  if(!cookies)return {SESH_ID, REFRESH_ID}
  const string = cookies.toString()


  if(request.SESH_ID){
    const indexOfSeshId_start = string.indexOf("SESH_ID") === -1 ? -1 : string.indexOf('=',string.indexOf("SESH_ID"))+1
    if(indexOfSeshId_start === -1) SESH_ID = null
    else{
      const indexOfRefreshId_end = string.indexOf(';',indexOfSeshId_start) === -1 ? undefined : string.indexOf(';',indexOfSeshId_start)
      SESH_ID = string.slice(indexOfSeshId_start,indexOfRefreshId_end)
    }
  }
  if(request.REFRESH_ID){
    const indexOfRefreshId_start = string.indexOf("REFRESH_ID") === -1 ? -1 : string.indexOf('=',string.indexOf("REFRESH_ID"))+1
    if(indexOfRefreshId_start === -1) REFRESH_ID = null
    else{
      const indexOfRefreshId_end = string.indexOf(';',indexOfRefreshId_start) === -1 ? undefined : string.indexOf(';',indexOfRefreshId_start)
      REFRESH_ID = string.slice(indexOfRefreshId_start,indexOfRefreshId_end)
    }
  }
  // console.log('found tokens: ',{SESH_ID,REFRESH_ID})
  return {
    SESH_ID,
    REFRESH_ID
  }
}
function checkLoggedIn(token){
  if(!token) return false 
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if(err) return false 
    return true
  })
}
async function checkRefreshToken(token){
  if(!token){
    console.log('No token given');
    return false;
  }
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
    if(err){
      console.log('Imposter refresh token');
      return false 
    }
    console.log('Refresh token derived from secret, checking for it in database.');

    try {
      const options = {
        headers:{
          "Content-Type":"application/json"
        },
        method:'POST',
        body:JSON.stringify({token})
      }
      const fetchRequest = new Request('http://'+ServerIp+':4001/validateRefreshTokenInDatabase')
      const response = await fetch(fetchRequest,options)
      const data = await response.json() 
      console.log(data.message)
      if(!response.ok) return false
      return true
    } catch (error) {
      console.log(' Server error checking for refresh token validity: ',error.message)      
      return false
    }
  })
}
function getUserFromAccessToken(accessToken){
  return jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, shallowUser_safe) => {
    if(err) {
      console.log('err in verify: ',err)
      return null
    }
    else if(shallowUser_safe === undefined) return null
    else return shallowUser_safe
  })
}



app.listen( port , () => console.log(`Client server listening on port ${port}`))