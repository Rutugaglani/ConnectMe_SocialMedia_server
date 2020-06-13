 /* eslint-disable */
 const router = require('express').Router();

 const cors = require('cors');
 

const functions = require('firebase-functions');
const app = require('express')();
app.use(cors());
const { admin , db } = require('./util/admin');
const { getAllScreams ,
      postOneScream , 
      getScream ,
      commentOnScream ,
      likeScream ,
      unlikeScream,
      deleteScream ,
      chat,getChats,
  } = require('./handlers/screams');
const { signup , login ,uploadImage ,addUserDetails,getAuthenticatedUser,
  markNotificationRead,
  getUserDetails, getAllUsers} = require('./handlers/users');

//const { FBAuth } = require('./util/FBAuth');

const FBAuth = (req,res,next)=> {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ){
        idToken = req.headers.authorization.split('Bearer ')[1];
    }
    else{
        console.error('No token found');
        return res.status(403).json({error: ' Unauthorized'});
    }
    admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
        req.user = decodedToken;
        console.log(decodedToken);
        return db.collection('users')
        .where('userid', '==' , req.user.uid)
        .limit(1)
        .get();
    })
    .then( data => {
        req.user.handle = data.docs[0].data().handle;
        req.user.imageUrl = data.docs[0].data().imageUrl;
        return next();
    })
    .catch( err => {
        console.error('Error while verifying token',err);
        return res.status(403).json(err);

    });
    
};


 // user routes
 app.post('/signup',signup);
 app.post('/login',login);
 app.post('/user/image',FBAuth,uploadImage);
 app.post('/user',FBAuth,addUserDetails);
 app.get('/user', FBAuth, getAuthenticatedUser);
 app.get('/user/:handle', getUserDetails);
 app.get('/users', getAllUsers);
 app.post('/notifications',FBAuth,markNotificationRead);


// screams route
 app.get('/screams', getAllScreams);
 app.post('/scream'  ,FBAuth, postOneScream); 
 app.post('/chat/:recepient',FBAuth, chat);
 app.get('/chat/:recepient',FBAuth, getChats);


 app.get('/screams/:screamId',getScream);
 app.post('/screams/:screamId/comments' ,FBAuth, commentOnScream);
  app.get('/screams/:screamId/likes' ,FBAuth, likeScream);
  app.get('/screams/:screamId/unlikes' ,FBAuth, unlikeScream);
app.delete ('/screams/:screamId',FBAuth,deleteScream);



// // https://baseurls.com/api/
 exports.api = functions.https.onRequest(app); 
 exports.CreateNotificationOnLike = functions
    .firestore
    .document('likes/{id}')
    .onCreate(async (snapshot) => {

        try {
            const scream = await db.collection('screams').doc(snapshot.data().screamId).get()

            if(scream.exists && scream.data().userHandle !== snapshot.data().userHandle){
                return await db.collection('notifications').doc(snapshot.id).set({
                    createdAt: new Date().toISOString(),
                    recipient: scream.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'like',
                    read: false,
                    screamId: scream.id

                })
            }

        } catch (err) {
            console.error(err)
        }

    })

exports.deleteNotificationsOnUnlike = functions
    .firestore
    .document('likes/{id}')
    .onDelete(async snapshot => {
        try {
            return await db.collection('notifications').doc(snapshot.id).delete();
        } catch (err) {
            console.error(err)
        }

    })

exports.createNotificationOnComment = functions
    .firestore
    .document('comments/{id}')
    .onCreate(async snapshot => {

        try {
            const scream = await db.collection('screams').doc(snapshot.data().screamId).get()
            if(scream.exists && scream.data().userHandle !== snapshot.data().userHandle){
                return await db.collection('notifications').doc(snapshot.id).set({
                    createdAt: new Date().toISOString(),
                    recipient: scream.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'comment',
                    read: false,
                    screamId: scream.id

                })
            }
        } catch (err) {
            console.error(err)
        }

    })

    exports.onUserImageChange = functions.firestore.document('/users/{userId}').onUpdate((change)=> {
      console.log(change.before.data());
      console.log(change.after.data());
      if( change.before.data().imageUrl !== change.after.data().imageUrl){
        console.log('image has changed');
        let batch = db.batch();
        return db.collection('screams').where('userHandle' , '==',change.before.data().handle ).get()
        .then((data)=>{
          data.forEach( doc =>{
            const screams = db.collection('screams').doc(doc.id);
            batch.update(screams , { userImage : change.after.data().imageUrl });
  
          });
          return batch.commit();
        })
      }


    });
    exports.onScreamDelete = functions.firestore.document('/screams/{screamId}').onDelete((snapshot , context) => {
      const screamId = context.params.screamId;
      const batch = db.batch();
      return db.collection('comments').where('screamId' , '==',screamId ).get()
      .then( data => {
        data.forEach( doc => {
          batch.delete( db.collection('comments').doc(doc.id));
        })
        return db.collection('likes').where('screamId','==',screamId).get();
      })
      .then( data => {
        data.forEach( doc => {
          batch.delete( db.collection('likes').doc(doc.id));
        })
        return db.collection('notifications').where('screamId','==',screamId).get();
      })
      .then( data => {
        data.forEach( doc => {
          batch.delete( db.collection('notifications').doc(doc.id));
        })  
        return batch.commit()
      })
      .catch( err => console.error( err ))
    })

