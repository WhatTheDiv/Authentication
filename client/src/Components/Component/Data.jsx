import React, {use, useState}  from 'react' 

export default function Data(props){
  const ServerIp = '192.168.2.105'

  function fetchUserData(){

    if(!props.bus.reload) return

    const Error = { err:false }
    const url = 'http://'+ServerIp+':3001/getUserData'
    const options = {
      method:'GET',
      headers:{
        'Content-Type':'application/json',
        'Access-Control-Allow-Credentials':'true'
      },
      credentials: 'include'
    }

    const res = use(fetch(url).then( res => {
      if(!res.ok){
        Error.err = true
        Error.status = res.status
        Error.message = res.message
        return {
          username: 'genericGene',
          name:'Gene'
        }
      }
      return res.json()
    }).then( data => {
      console.log('fetch results: ',data)
      props.setBus({
       reload:false,
       name:data.name,
       username:data.username,
       connected:!Error.err
      })
    }))
  }

  fetchUserData()
  console.log(props.bus)
  return(
    <div>
        <h1>Welcome, {props.bus.username}</h1>
      </div>
  )
}