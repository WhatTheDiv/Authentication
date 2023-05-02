import React, { Suspense, useState, useEffect } from 'react'
import '../Styles/App.css';
import Data from './Data';
import ErrorBoundary from './ErrorBoundary';
import Icon_Menu from '../../Resources/Icons/menuIcon.png'

export default function App() {
  const [ appState, setAppState ] = useState({
    connected:true,
    reload:true,
    name:null,
    serverIp:'192.168.2.105'
  })
  const [ page, setPage ] = useState('home')

  async function button_logout() {
    if(!appState.connected){
      console.log('This is only a test environment!')
      return;
    }
    const url = 'http://'+appState.serverIp+':4001/logout'
    const options = {
      method:'DELETE',
      headers:{
        'Content-Type':'application/json',
        'Access-Control-Allow-Credentials':'true'
      },
      credentials: 'include'
    }
    const res = await fetch(url, options)
    const data = await res.json()

    !res.ok ? 
      console.log('Bad logout(',res.status,'): ',data.message) : 
      console.log('Good logout ',data.message)

    document.cookie = "SESH_ID=; expires="+new Date()+"; path=http://"+appState.serverIp
    document.cookie = "REFRESH_ID=; expires="+new Date()+"; path=http://"+appState.serverIp
    document.location.reload()
  }
  function page_reload() {
    setAppState({
      ... appState,
      reload:true
    })
  }
  function menu_toggleShow(){
    const div = document.querySelector('.container_MenuPullout')
    const classList = div.className.split(' ')
    const className = classList[1] === 'pullout_open' ? 'pullout_closed' : 'pullout_open'
    classList[1] = className
    div.className = classList.join(' ')
  }
  function toggle_page(newPage) {
    setPage(newPage)
    setAppState({
      ...appState,
      reload:true
    })
    menu_toggleShow()
  }
  
  
  console.log('Loading app container')
  const name = appState.name === null ? null : (', '+appState.name)
  
  return (
    <div className="container_App">
      <div className="container_Header">
        <img onClick={ menu_toggleShow } src={Icon_Menu} alt='menu'/>
        <h1 onClick={ page_reload }>
          Welcome{ name }
        </h1>
      </div>
      <div className="container_MenuPullout pullout_closed">
        <ul>
          <li onClick={() => toggle_page('home')}>Home</li>
          <li onClick={() => toggle_page('ecomm')}>Ecomm</li>
          <li onClick={() => toggle_page('profile')}>Profile</li>
          <li onClick={button_logout}>Logout</li>
        </ul>
      </div>
      <ErrorBoundary fallback='Therre was an error'>
        <Suspense fallback={<div>Loading ...</div>}>
          <Data bus={appState} setBus={setAppState} page={page} setPage={setPage}></Data>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

