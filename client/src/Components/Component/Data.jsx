import React, {use}  from 'react' 

export default function Data(){
  const url = "https://api.github.com/users/genericcreations/repos"
  
  const data = use(fetch(url).then( res => res.json()))
  console.log('data',data)

  return(
    <div>Done Loading</div>
  )
}