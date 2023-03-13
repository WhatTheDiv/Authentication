
require ('dotenv').config()
const express = require('express')
const app = express()
const port = 4001
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const users = []

                                //               AUTHENTICATION SERVER                // 

app.use(express.json({limit:'10mb'}))

let refreshTokens = []

// testing
app.get('/users', (req,res) => {
  // responds with full user list
  res.json(users)
})


// main

app.delete('/logout', (req,res) => {      /*         DELETE REFRESH TOKEN          */
  // create new refreshTokens array without this token
  refreshTokens = refreshTokens.filter( token => token !== req.body.token)

  // send success
  res.sendStatus(204)
})
app.post('/token', (req,res) => {         /*         REFRESH TOKEN                 */ 
  // assign refreshtoken sent in fetch to varaible
  const refreshToken = req.body.token

  // verify token was sent with request and token is in refreshTokens array
  if(refreshToken == null) return res.sendStatus(401) 
  if(!refreshTokens.includes(refreshToken)) return res.sendStatus(403)

  // verify refreshToken came from server private key  
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if(err) return res.sendStatus(403)

    // create a new access token with current user
    const accessToken = generateAccessToken({ name: user.name, password: user.password })

    // send success
    res.json({ accessToken })
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
    users.push(user)

    // if success, send success
    res.sendStatus(201)

  } catch (error) {
    // if error, send fail
    res.sendStatus(500)
  }
})
app.post('/login', async (req,res) => {   /*         LOGS IN USER                  */
  // finds user in user array that has matching name
  const user = users.find(user => user.name === req.body.name)

  // if no user found, reject
  if(user == null) return res.sendStatus(400).send('Cannot find user')

  try {

    // compare password provided to password stored in user
    if(await bcrypt.compare(req.body.password, user.password)){

      // * if good password * generates an access token from user
      const accessToken = generateAccessToken({ name: user.name, password:user.password })

      // generates an access token
      const refreshToken = jwt.sign({name:user.name, password:user.password}, process.env.REFRESH_TOKEN_SECRET)

      // adds new refreshToken to refreshTokens array
      refreshTokens.push(refreshToken)

      // if success, passes access token and refresh token to user
      res.json({ accessToken, refreshToken }).sendStatus(202)
    } else {

      // if error, rejects request
      res.sendStatus(401).send('Not allowed')
    }
  } catch (error) {
    
  }
})

function generateAccessToken(user) {
  // takes { name, password } from user and generates access token
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' })
}

app.listen( port , () => console.log(`Authentication server listening on port ${port}`))