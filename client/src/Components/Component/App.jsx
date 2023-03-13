import React, { Suspense } from 'react'
import '../Styles/App.css';
import Data from './Data';

export default function App() {
  console.log('do it once')


  return (
    <div className="container_App">
      <Suspense fallback={<div>Loading ...</div>}>
        <Data>
        </Data>
      </Suspense>
    </div>
  );
}

