

async function submitRegisterUserData(t){
  const inputs = document.querySelectorAll('.formInput')
  if(inputs.length <= 0) throw new Error('nothing given to form')

  const options = {
    method:'POST',
    credentials: 'include',
    headers:{
      'Content-Type':'application/json',
    },
    body:JSON.stringify({
      name:inputs[0].value,
      email:inputs[1].value,
      username:inputs[2].value,
      password:inputs[3].value
    })
  }
  const errObj = {}
  try {
    const res = await fetch('http://localhost:4001/createNewUser',options)
    console.log(res);
    if(!res.ok){
      const data = await res.json()
      errObj.status = res.status
      errObj.message = data.message
      throw new Error(data.message)
    }
    console.log('check point')
    location.replace('http://localhost:3001/')
  } catch (err) {
    const errDispElement = document.querySelector('#errorMessage')
    errDispElement.innerText = '* '+errObj.message+' *'
    errDispElement.style.display = 'block'
    console.warn(`Fetch Error! Status ${errObj.status}`)
    console.warn(err)
  }
    
}
async function submitLoginUserData(t) {
  const inputs = document.querySelectorAll('.formInput')
  if(inputs.length <= 0) throw new Error('nothing given to form')
  
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
    const res = await fetch('http://localhost:4001/loginUser',options)
    const data = await res.json()


    if(!res.ok){
      errObj.status = res.status
      errObj.message = data.message
      throw new Error(data.message)
    }

    document.cookie = "SESH_ID="+data.accessToken+";"
    document.cookie = "REFRESH_ID="+data.refreshToken+";"
    location.reload()

  } catch (err) {
    const errDispElement = document.querySelector('#errorMessage')
    errDispElement.innerText = '* '+errObj.message+' *'
    errDispElement.style.display = 'block'
    console.warn(`Fetch Error! Status ${errObj.status}`)
    console.error(err)
  }
  
}
function routeToLoginPage(){
  location.replace('/')
}
function routeToRegisterPage(){
  location.replace('/login/HTML/register.html')
}
function inputClick(input) {
  input.select()
}

document.querySelector('#formSubmit').addEventListener('click',(event) => event.preventDefault())
document.querySelector('#formRedirect').addEventListener('click',(event) => event.preventDefault())
