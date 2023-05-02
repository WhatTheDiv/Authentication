import React, {useState, use} from 'react' 
import Icon_Edit from '../../Resources/Icons/edit.png'
import '../Styles/Profile.css'

export default function Profile(props) {
  function toggleEdit() {
    setEdit(!edit)
  }
  function button_cancelEdit() {
    toggleEdit()
    setEditPassword(false)
  }
  function button_submitEdit() {
    const updatedUserInfo = {}
    const name = document.querySelector('#updateInfo_name').value
    const username = document.querySelector('#updateInfo_username').value
    const email = document.querySelector('#updateInfo_email').value
    console.log({inputFields:{name,username,email}})

    if(name !== props.bus.name) updatedUserInfo.name = name
    if(username !== props.bus.username) updatedUserInfo.username = username
    if(email !== props.bus.email) updatedUserInfo.email = email
    console.log('updating user with: ',updatedUserInfo)

    serverCall_updateUserInfo(updatedUserInfo)
    button_cancelEdit()
  }
  function serverCall_updateUserInfo(newUserInfo) {
    function setState_main(userData){
      console.log('profile setting state with : ',userData)
      props.setBus({
        ...props.bus,
        reload:false,
        ...userData
       })
    }
    const Error = { err:false }
    const returnObj = {}
    const Body = {...newUserInfo}
    const url = 'http://'+props.bus.serverIp+':3001/setUserData'
    const options = {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
      },
      body:JSON.stringify(Body)
    }
    fetch(url,options)
      .then( res => {
        if(!res.ok){
          console.log('profile - fetch not okay',res)
          Error.err = true
          Error.status = res.status
          Error.message = res.message
        }
        return res.json()
      }).then( data => {
        console.log('profile - resolved json: ',data,Error)
        if(Error.err){
          return console.log('Error updating user data.')
        }
        if(data.user.name) returnObj.name = data.user.name
        if(data.user.username) returnObj.username = data.user.username
        if(data.user.email) returnObj.email = data.user.email
        return setState_main(returnObj)

      }).catch( e => {
      console.log('profile - Handling error contacting server: ',e)
      return

    })
  }

  const [ edit, setEdit ] = useState(false)
  const [ editPassword, setEditPassword ] = useState(false)
  const editButtonClassName = edit ? 'edit_hide' : 'edit_show'
  const editItemsClassName = edit ? 'edit_show' : 'edit_hide'
  return (
    <div className='container_profile'>
      <h1>Profile</h1>
      <img src={Icon_Edit} className={editButtonClassName} alt='edit' onClick={ toggleEdit }/>
      <div className='container_userInfo'>
        <span>
          <h3>Name</h3>
          {
            edit ? 
              <input id='updateInfo_name' type='text' defaultValue={props.bus.name}/>
              : <p>{props.bus.name}</p>
          }
        </span>
        <span>
          <h3>Email address</h3>
          {
            edit ? 
              <input id='updateInfo_email' type='text' defaultValue={props.bus.email}/>
              : <p>{props.bus.email}</p>
          }
        </span>
        <span>
          <h3>Username</h3>
          {
            edit ? 
              <input id='updateInfo_username' type='text' defaultValue={props.bus.username}/>
              : <p>{props.bus.username}</p>
          }
        </span>
        <span>
          <h3>Password</h3>
          {
            edit ? 
              editPassword ? 
                <input id='updateInfo_newPassword' type='password' placeholder="Current"/> 
                : <button onClick={ () => setEditPassword(!editPassword)}>Change Password</button>
              : <p>{"**********"}</p>
          }
        </span>
        {
          !editPassword ? null : 
          <span>
          <h3>New Password</h3>
          <input id='updateInfo_newPassword' type='password' placeholder="New"/>
        </span>
        }
        {
          !editPassword ? null : 
          <span>
          <h3>New Password</h3>
          <input id='updateInfo_newPassword' type='password' placeholder="Confirm New"/>
        </span>
        }
      </div>
      <div className={'container_userInfoButtons '+editItemsClassName}>
        <input onClick={ button_submitEdit } type="button" className='button_primary' value='Save'/>
        <input onClick={ button_cancelEdit } type="button" className='button_primary' value='Cancel'/>
      </div>
    </div>
  )
}