# 1. usage

check your online status in average 100ms

use tcp connect check

```javascript
const {NetTool}=require('nettools');

// options is not require
let options = {
    language: 'ar-EG', // smart to skip some web site block by egypt, if this project support
    special: ['8.8.4.4:53',],//add check list
    black: [],//add check black list
};

let nt = new NetTool();

nt.isOnline()
    .then(result=>console.log(result))
    .catch(e=>console.log(e))

nt.getStatus()
    .then(result=>console.log(result))
    .catch(e=>console.log(e))

```
