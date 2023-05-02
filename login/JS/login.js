
var ServerIp = '192.168.2.105'
if(document.querySelector('#login_username')) 
  document.querySelector('#login_username').value = localStorage.username ? localStorage.username : ""
if(document.querySelector('#rememberMe')) 
  document.querySelector('#rememberMe').checked = localStorage.rememberMe === 'true' ? true : false
  
async function submitRegisterUserData(){
  const inputs = document.querySelectorAll('.formInput')
  if(inputs.length <= 0) throw new Error('nothing given to form')

  const options = {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
    },
    body:JSON.stringify({user:{
      name:inputs[0].value,
      email:inputs[1].value,
      username:inputs[2].value,
      password:inputs[3].value
    }})
  }
  const errObj = {}
  try {
    const res = await fetch('http://'+ServerIp+':3001/newUser',options)
    console.log(res);
    if(!res.ok){
      const data = await res.json()
      errObj.status = res.status
      errObj.message = data.message
      throw new Error(data.message)
    }
    location.replace('http://'+ServerIp+':3001/')
  } catch (err) {
    const errDispElement = document.querySelector('#errorMessage')
    errDispElement.innerText = '* '+errObj.message+' *'
    errDispElement.style.display = 'block'
    console.warn(`Fetch Error! Status ${errObj.status}`)
    console.warn(err)
  }
    
}
async function submitLoginUserData() {
  const inputs = document.querySelectorAll('.formInput')
  if(inputs.length <= 0) throw new Error('nothing given to form')
  if(inputs[2].checked){
    localStorage.username = inputs[0].value
    localStorage.rememberMe = true
  }
  else if(!inputs[2].checked){
    localStorage.username = ""
    localStorage.rememberMe = false
  }
  
  const options = {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Access-Control-Allow-Credentials':'true'
    },
    credentials: 'include',
    body:JSON.stringify({
      username:inputs[0].value,
      password:inputs[1].value
    })
  }
  
  const errObj = {}
  try {
    const res = await fetch('http://'+ServerIp+':4001/login',options)
    const data = await res.json()

    if(!res.ok){
      errObj.status = res.status
      errObj.message = data.message
      throw new Error(data.message)
    }

    console.log('data back from login: ',data)

    location.reload()

  } catch (err) {
    const errDispElement = document.querySelector('#errorMessage')
    errDispElement.innerText = errObj.message
    errDispElement.style.display = 'block'
    console.warn(`Fetch Error! Status ${errObj.status}`)
    console.error(err)
  }
  
}
function routeToLoginPage(){
  location.replace('/')
}
function routeToRegisterPage(){
  location.replace('/register')
}
function inputClick(input) {
  input.select()
}
function toggle_showPassword() {
  const passwordInput = document.querySelector('#current-password')
  const showPasswordLabel = document.querySelector('#showPassword')

  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password'
  showPasswordLabel.innerText = showPasswordLabel.innerText === 'Show Password' ? 'Hide Password' : 'Show Password'
}
function forgotPassword() {

}

document.querySelector('#formSubmit').addEventListener('click',(event) => event.preventDefault())
document.querySelector('#formRedirect').addEventListener('click',(event) => event.preventDefault())
