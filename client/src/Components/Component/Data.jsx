import React, {use}  from 'react' 

export default function Data(){
  // const url = "https://api.github.com/users/genericcreations/repos"
  // const data = use(fetch(url).then( res => res.json()))
  function button_logout() {
    console.log('logout button')
    document.cookie = "SESH_ID=; expires="+new Date()+"; path=http://localhost"
    document.cookie = "REFRESH_ID=; expires="+new Date()+"; path=http://localhost"
    document.location.reload()
  }

  return(
    <div>
      <div>Done Loading</div>
      <div>
        <input type="button" value="Logout" onClick={button_logout} />
      </div>
    </div>
  )
}