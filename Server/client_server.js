
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

app.use(express.static( path.resolve(__dirname, '../client/build')))
app.use(express.json({limit:'10mb'}))

app.get( '/', (req,res) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
})

app.get('/posts', authenticateToken, (req,res) => {
  res.json(posts.filter(post => post.username === req.user.name))
})

function authenticateToken( req, res, next){

  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if(token == null) return res.sendStatus(401)
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if(err) return res.sendStatus(403)

    req.user = user 
    next()
  })
}


app.listen( port , () => console.log(`Client server listening on port ${port}`))