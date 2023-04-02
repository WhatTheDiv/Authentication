import React, { Suspense, useState } from 'react'
import '../Styles/App.css';
import Data from './Data';
import Icon_Menu from '../../Resources/Icons/menuIcon.png'

export default function App() {
  const [ appState, setAppState ] = useState({
    connected:true,
    reload:true,
    name:null
  })
  let rawName = null
  function button_logout() {
    if(!appState.connected){
      console.log('This is only a test environment!')
      return;
    }
    document.cookie = "SESH_ID=; expires="+new Date()+"; path=http://localhost"
    document.cookie = "REFRESH_ID=; expires="+new Date()+"; path=http://localhost"
    document.location.reload()
  }
  function page_reload() {
    setAppState({
      ... appState,
      reload:true
    })
  }
  console.log('do it once')

  return (
    <div className="container_App">
      <div className="container_Header">
        <img src={Icon_Menu} alt='menu'/>
        <input type="button" value="Logout" onClick={button_logout} />
        <h1 onClick={ page_reload }>
          Welcome{ appState.name === null ? null : (', '+appState.name)}
        </h1>
      </div>
      <Suspense fallback={<div>Loading ...</div>}>
        <Data bus={appState} setBus={setAppState}>
        </Data>
      </Suspense>
    </div>
  );
}

