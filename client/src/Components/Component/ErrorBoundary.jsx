import React from 'react' 
import '../Styles/ErrorBoundary_styles.css'

export default class ErrorBoundary extends React.Component{
  state = { hasError: false }

  static getDerivedStateFromError(error){
    return { hasError: true}
  }

  componentDidCatch(error, info){
    // console.log(error, info)
  }
  build_errorDisplay(){
    return(
      <div className='container_ErroBoundary'> 
        <span>An error has occured :'(</span>
        <p></p>
      </div>
    )
  }

  render(){
    if(this.state.hasError) {
      return this.build_errorDisplay()
    }
    return this.props.children
  }
}