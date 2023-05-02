import React, {Suspense, use, useState}  from 'react' 
import ErrorBoundary from './ErrorBoundary'
import Home from './Home'
import Profile from './Profile'
import Ecomm from './Ecomm'

export default function Data(props){

  function setup_userData(){
    function setState_main(userData){
      console.log('setting state with : ',userData)
      props.setBus({
        ...props.bus,
        reload:false,
        name:userData.name,
        email:userData.email,
        username:userData.username,
        connected:userData.connected
       })
    }
    function fetch_userData(){
      const Error = { err:false }
      const returnObj = {}
      const url = 'http://'+props.bus.serverIp+':3001/getUserData'
      const options = {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          // 'Access-Control-Allow-Credentials':'true'
        },
        // credentials: 'include'
      }
  
      use(fetch(url,options).then( res => {
        if(!res.ok){
          console.log('fetch not okay',res)
          Error.err = true
          Error.status = res.status
          Error.message = res.message
        }
        return res.json()
      }).then( data => {
        console.log('resolved json: ',data,Error)
        if(Error.err){
          returnObj.name = data.name
          returnObj.username = data.username
          returnObj.email = data.email
          returnObj.connected = false
          return setState_main(returnObj)
        }
        returnObj.name = data.name
        returnObj.username = data.username
        returnObj.email = data.email
        returnObj.connected = true
        return setState_main(returnObj)

      }).catch( e => {
        console.log('Handling error: ',e.message)
        returnObj.name = 'User'
        returnObj.username = 'genericUser'
        returnObj.email = 'generic@email.com'
        returnObj.connected = false
        console.log('resolved obj: ',returnObj)

        return setState_main(returnObj)

      }))
    }

    if(!props.bus.reload) return
    console.log('fetching user data')
    // const width = window.innerWidth;
    // const height = window.innerHeight;
    // alert(`The viewport's width is ${width} and the height is ${height}.`);
    fetch_userData()
  }
  function display_page() {
    let section = null
    switch(props.page){
      case 'home':
        section = <Home bus={props.bus} setBus={props.setBus} ></Home>
        break;
      case 'profile':
        section = <Profile bus={props.bus} setBus={props.setBus} ></Profile>
        break;
      case 'ecomm':
        section = <Ecomm bus={props.bus} setBus={props.setBus} ></Ecomm>
        break;
    }
    return (
      <ErrorBoundary>
        <Suspense fallback={<div>getting ... </div>}>
          { section }
        </Suspense>
      </ErrorBoundary>
    )
  }
  console.log('setting up data')
  setup_userData()

  return(
    <div>
        { display_page() }
      </div>
  )
}