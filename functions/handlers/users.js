 /* eslint-disable */

const { admin ,db } =require('../util/admin');
const firebase = require('firebase');
const config = require('../util/config');
const { validateSignupData,validateLoginData,reduceUserDetails}= require('../util/validators')

firebase.initializeApp(config);


exports.signup = (req,res)=>
{
     const newUser ={
         email : req.body.email,
         password : req.body.password,
         confirmPassword : req.body.confirmPassword,
         handle : req.body.handle,
     };
     const { valid ,errors }= validateSignupData(newUser);
     if(!valid) return res.status(400).json(errors);
     const Id =newUser.handle;
     const noImg ='default.png';

     return db.collection('users').doc(Id)
     .get()
     .then((doc) => {
       if (doc.exists) {
         return res.status(400).json({ handle: "this handle is already taken" });
       } else {
         return firebase
           .auth()
           .createUserWithEmailAndPassword(newUser.email, newUser.password);
       }
     })

           .then((data) => {
               userid = data.user.uid;
               return data.user.getIdToken();
             })
             .then((idToken) => {
               token = idToken;
               const userCredentials = {
                 handle: newUser.handle,
                 email: newUser.email,
                 imageUrl:`https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                 createdAt: new Date().toISOString(),
                 //TODO Append token to imageUrl. Work around just add token from image in storage.
                 userid,
               };
              
               console.log(Id)
               return db.collection('users').doc(Id).set(userCredentials);
             })
             .then(() => {
               return res.status(201).json({ token });
             })
             .catch((err) => {
               console.error(err);
               if (err.code === "auth/email-already-in-use") {
                 return res.status(400).json({ email: "Email is already is use" });
               } else {
                 return res
                   .status(500)
                   .json({ general: "Something went wrong, please try again" });
               }
             });
         };

         exports.login = (req, res) => {
          const user = {
            email: req.body.email,
            password: req.body.password,
          };
        
          const { valid, errors } = validateLoginData(user);
        
          if (!valid) return res.status(400).json(errors);
        
          firebase
            .auth()
            .signInWithEmailAndPassword(user.email, user.password)
            .then((data) => {
              return data.user.getIdToken();
            })
            .then((token) => {
              return res.json({ token });
            })
            .catch((err) => {
              console.error(err);
              // auth/wrong-password
              // auth/user-not-user
              return res
                .status(403)
                .json({ general: "Wrong credentials, please try again" });
            });
        };
         // Get user Details

         exports.getAuthenticatedUser = (req, res) => {
          let userData = {};
          const handle =req.user.handle;
           db.collection('users').doc(handle).get()
            
            .then((doc) => {
              if (doc.exists) {
                userData.credentials = doc.data();
                return db
                  .collection("likes")
                  .where("userHandle", "==", req.user.handle)
                  .get();
              }
            })
            .then((data) => {
              userData.likes = [];
              data.forEach((doc) => {
                userData.likes.push(doc.data());
              });
              return db
                .collection("notifications")
                .where("recipient", "==", req.user.handle)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            })
            .then((data) => {
              userData.notifications = [];
              data.forEach((doc) => {
                userData.notifications.push({
                  recipient: doc.data().recipient,
                  sender: doc.data().sender,
                  createdAt: doc.data().createdAt,
                  screamId: doc.data().screamId,
                  type: doc.data().type,
                  read: doc.data().read,
                  notificationId: doc.id,
                });
              });
              return res.json(userData);
            })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({ error: err.code });
            });
        };

        
      exports.getAllUsers = (req,res)=>{
        db.collection('users').get()
        .then((data) =>{
          let users=[];
          data.forEach((doc)=>{
            users.push({
              userId : doc.id,
              userHandle : doc.data().handle,
              createdAt : doc.data().createdAt,
              userImage:doc.data().imageUrl
            })
          })
          return res.json(users);
        })
        .catch(err =>{
          console.error(err);
          return res.status(500).json({ error : err.code});
        })
      }


      //Get any user Detail
      exports.getUserDetails=(req,res)=>{
        let userData={};
        db.collection('users').doc(req.params.handle).get()
        .then(doc =>{
          if(doc.exists){
            userData.user = doc.data();
            return db.collection('screams').where('userHandle','==', req.params.handle).orderBy('createdAt','desc').get();
          }
          else{
            return res.status(404).json({error : 'User not Found'});
          }
        })
        .then(data => {
          userData.screams = [];
          data.forEach( doc =>{
            userData.screams.push({
              body : doc.data().body,
              createdAt : doc.data().createdAt,
              userHandle : doc.data().userHandle,
              userImage : doc.data().userImage,
              likeCount : doc.data().likeCount,
              commentCount : doc.data().commentCount,
              screamId : doc.id
            })
          });
          return res.json(userData);
        })
        .catch(err =>{
          console.error(err);
          return res.status(500).json({ error : err.code});
        })

      }     

         //Add
         exports.addUserDetails=(req,res)=>{
          let userDetails = reduceUserDetails(req.body); 
          const Id =req.user.handle;
          db.collection('users').doc(Id).update(userDetails)
          .then(()=>{
            return res.json({message : "details added successfully"});
          })
          .catch(err =>{
            console.error(err);
            return res.status(500).json({err:err.code})
          })
         }


         exports.markNotificationRead =(req,res)=>{
           let batch = db.batch();
           req.body.forEach(notificationId =>{
             const notification = db.collection('notifications').doc(notificationId);
             batch.update( notification,{read:true});
             
           });
           batch.commit()
           .then(()=>{
             return res.json({ message :' Notifications marked read'});
           })
           .catch( err =>{
             console.error(err);
             return res.status(500).json({error:err.code})
           })
         }
   
         exports.uploadImage =(req,res)=> {
            const BusBoy = require('busboy');
            const path = require('path');
            const os = require('os');
            const fs = require('fs');
       
            const busboy = new BusBoy({ headers: req.headers });
      
            let imageFileName;
            let imageToBeUploaded = {};
      
            busboy.on('file',(fieldname,file,filename,encoding,mimetype)=>{
              if( mimetype != 'image/jpeg' && mimetype != 'image/png'){
                return res.status(400).json({ error : "Wrong file type submitted"});
              }
      
              console.log(fieldname, file, filename, encoding, mimetype);
      
                const imageExtension = filename.split(".")[filename.split(".").length - 1];
                       imageFileName = `${Math.round(
                        Math.random() * 1000000000000
                       ).toString()}.${imageExtension}`;
                     const filepath = path.join(os.tmpdir(), imageFileName);
                      imageToBeUploaded = { filepath, mimetype };
      
                file.pipe(fs.createWriteStream(filepath));
      
            });
            busboy.on("finish", () => {
                admin
                  .storage()
                  .bucket()
                  .upload(imageToBeUploaded.filepath, {
                    resumable: false,
                    metadata: {
                      metadata: {
                        contentType: imageToBeUploaded.mimetype,

                      },
                    },
                  })

                  
                .then(() => {
                    
                    //without alt=media it will download the image file rather than showing it on browser
                    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
                   
                    return db.collection('users').doc(req.user.handle).update({ imageUrl});
                })
                .then(()=>{
                    return res.json({ message : 'Image uploaded successfully '});
                })
                .catch( err => {
                    console.error(err);
                    return res.status(500).json({ error : err.code });
                })
            });
            busboy.end(req.rawBody);
         }