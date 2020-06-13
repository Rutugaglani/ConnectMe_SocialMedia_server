 /* eslint-disable */

const { db } = require('../util/admin');
const { validateScream }= require('../util/validators')

exports.getAllScreams = (req,res)=>{

    db
    .collection('screams')
    .orderBy('createdAt','desc')
    .get()
    .then((data) => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId : doc.id,
                body:doc.data().body,
                userHandle : doc.data().userHandle,
                createdAt : doc.data().createdAt,
                commentCount : doc.data().commentCount,
                likeCount:doc.data().likeCount,
                userImage:doc.data().userImage
                
            });
        } );
        return res.json(screams);
    })
    .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
}

exports.postOneScream=(req,res)=>
{
    const isBodyEmpty =req.body.body;
    const { valid,errors }= validateScream(isBodyEmpty)

    if (!valid) return res.status(400).json(errors);

    const newScream = {
        body : req.body.body,
        userHandle : req.user.handle,
        createdAt : new Date().toISOString(),
        userImage: req.user.imageUrl,
        likeCount : 0,
        commentCount :0
};
    db
    .collection('screams')
    .add(newScream)
    .then((doc) => {
        const resScream = newScream;
        resScream.screamId = doc.id;
       return  res.json(resScream);
    })
    .catch((err)=>{
        console.error(err);
        return res.status(500).json({error: `something went wrong`});
       
    });
}
exports.chat=(req,res)=>
{
    const message = {
        body : req.body.body,
        sender : req.user.handle,
        recepient:req.params.recepient,
        createdAt : new Date().toISOString(),
        userImage: req.user.imageUrl,
        like : false,
        
};
    db
    .collection('messages')
    .add(message)
    .then((doc) => {
        const resMessage = message;
        resMessage.msgId = doc.id;
       return  res.json(resMessage);
    })
    .catch((err)=>{
        console.error(err);
        return res.status(500).json({error: `something went wrong`});
       
    });
}
exports.getChats=(req,res)=>{
    db.collection('messages')
    .where('recepient','in' ,[req.user.handle,req.params.recepient])
    .orderBy('createdAt')
    .get()
    .then((data) => {
        let messages = [];
        data.forEach(doc => {
            messages.push({
                msgId : doc.id,
                body:doc.data().body,
                sender : doc.data().sender,
                recepient:doc.data().recepient,
                createdAt : doc.data().createdAt,
                like: doc.data().like,
                userImage:doc.data().userImage
                
            });
        } );
        return res.json(messages);
    })
    .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
}

exports.getScream=(req,res)=>{
    let screamData ={};
    db.collection('screams').doc(req.params.screamId).get()
    .then(doc => {
        if(!doc.exists){
            return res.status(404).json({ error : 'Scream not found'})
        }
        screamData = doc.data();
        screamData.screamId = doc.id;

        return db.collection('comments').orderBy('createdAt','desc').where('screamId','==', req.params.screamId).get();


    })
    .then (data =>{
        screamData.comments = [];
        data.forEach(doc => {
            screamData.comments.push(doc.data())
        });
        return res.json(screamData)
    })
    .catch( err => {
        console.error(err);
        res.status(500).json({error : err.code});
    })
}
//comment on scream
exports.commentOnScream = (req, res) => {
    if (req.body.body.trim() === '')
      return res.status(400).json({ comment: 'Must not be empty' });
  
    const newComment = {
      body: req.body.body,
      createdAt: new Date().toISOString(),
      screamId: req.params.screamId,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl
    };
    console.log(newComment);
  
    db.collection('screams').doc(req.params.screamId)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Scream not found' });
        }
        return doc.ref.update({ commentCount : doc.data().commentCount + 1});
       
      })
      .then( ()=>{
        return db.collection('comments').add(newComment);
      })
      .then(() => {
        res.json(newComment);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ error: 'Something went wrong' });
      });
  };

  exports.likeScream = (req,res) =>{
      const likeDocument = db.collection('likes').where('userHandle','==', req.user.handle)
      .where('screamId','==', req.params.screamId)

      const screamDocument = db.collection('screams').doc(req.params.screamId);

      let screamData;
      screamDocument.get()
      .then(doc =>{
          if(doc.exists){
              screamData = doc.data();
              screamData.screamId = doc.id;
              return likeDocument.get();
          }
          else{
              return res.status(404).json({error :'Scream not found'});
          }
      })
      .then( data =>{
          if(data.empty){
              return db.collection('likes').add({
                  screamId: req.params.screamId,
                  userHandle : req.user.handle
              })
              .then(()=>{
                  screamData.likeCount++
                  return screamDocument.update({ likeCount : screamData.likeCount});
              })
              .then(()=>{
                  return res.json(screamData);

              })
          }
          else{
              return res.status(400).json({ error : 'Scream already liked !!'})
          }
      })
      .catch( err =>{
          console.error(err);
          res.status(500).json({error : err.code});
      })
  };

  exports.unlikeScream = (req,res) =>{
    const likeDocument = db.collection('likes').where('userHandle','==', req.user.handle)
    .where('screamId','==', req.params.screamId)

    const screamDocument = db.collection('screams').doc(req.params.screamId);

    let screamData;
    screamDocument.get()
    .then(doc =>{
        if(doc.exists){
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        }
        else{
            return res.status(404).json({error :'Scream not found'});
        }
    })
    .then( data =>{
        if(data.empty){
            return res.status(400).json({ error : 'Scream not liked !!'});
            
        }
        else{
            return db.collection('likes').doc(data.docs[0].id).delete()
            .then(()=>{
                screamData.likeCount--;
                return screamDocument.update({ likeCount:screamData.likeCount});

            })
            .then(()=> {
                res.json(screamData);
            })    
        }
    })
    .catch( err =>{
        console.error(err);
        res.status(500).json({error : err.code});
    })
};

exports.deleteScream=(req,res)=>{
const document = db.collection('screams').doc(req.params.screamId);
document.get()
.then( doc => {
    if(!doc.exists){
        return res.status(404).json({error : 'Scream not found'});
    }
    if(doc.data().userHandle !== req.user.handle ){
        return res.status(403).json({ error : 'Unauthorized '});
    }
    else {
        return document.delete();
    }
})
.then (()=>{
    res.json({ message : 'Scream deleted successfully '});
})
.catch( err => {
    console.error(err);
    return res.status(500).json({error : err.code});
})

}


