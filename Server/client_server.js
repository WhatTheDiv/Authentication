
require ('dotenv').config()
const express = require('express')
const app = express()
const port = 3001
const path = require('path')
const jwt = require('jsonwebtoken')


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

app.get('/',middleware_checkLoggedIn, (req,res) => {
  console.log('cp');
  if(req.isLoggedIn){
    console.log('is logged in');
    return res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
  } else if(!req.isLoggedIn){
    console.log('is not logged in');
    return res.sendFile(path.resolve(__dirname, '../login/HTML', 'login.html'))
  }
})
app.get('/getMyRestrictedContent', authenticateToken, (req,res) => {
  res.json(posts.filter(posts => posts.username === req.user.username))
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
  console.log('cp middleware');
  const tokens = findTokensInCookie(req.headers.cookie)
  if(checkLoggedIn(tokens.SESH_ID)){
    req.isLoggedIn = true
    next()
  }
  else if(checkRefreshToken(tokens.REFRESH_ID)){
    try {
      const options = {
        headers:{
          "Content-Type":"application/json"
        },
        method:'POST',
        body:JSON.stringify({token:tokens.REFRESH_ID})
      }
      const fetchRequest = new Request('http://localhost:4001/getNewAccessToken')
      const response = await fetch(fetchRequest,options)
      if(!response.ok) throw new Error('Bad getNewAccessToken fetch')
      const data = await response.json()

      const user = getUserFromAccessToken(data.token)
      console.log('New access token created by ',user.username)

      req.isLoggedIn = true
      res.set({'Set-Cookie':"SESH_ID="+data.token+"; path=http://localhost"})
      next()

    } catch (err) {
      console.log('Failed to use refresh token: ',err)
      req.isLoggedIn = false 
      next()
    }

  }
  else{
    req.isLoggedIn = false 
    next()
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
function checkRefreshToken(token){
  console.log('check refresh tokens');

  if(!token) return false 
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if(err){
      console.log('no refresh token');
      return false 
    }
    console.log('good refresh token');
    return true
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