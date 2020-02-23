const express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    passport = require("passport"),
    path = require("path"),
    sanitizer = require("express-sanitizer"),
    methodOverride = require("method-override"),
    localStrategy = require("passport-local"),
    fs = require("fs"),
    flash = require("connect-flash"),
    resize = require("./resize"),
    User = require("./models/user"),
    Activity = require("./models/activity"),
    Issue = require("./models/issue"),
    Comment = require("./models/comment"),
    userRoutes = require("./routes/users"),
    adminRoutes = require("./routes/admin"),
    bookRoutes = require("./routes/books"),
    authRoutes = require("./routes/auth"),
    middleware = require("./middleware");
    // Seed = require('./seed');

 //Seed(1000);


app.set("view engine", "ejs");
app.use(methodOverride("_method"));
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended : true}));
app.use(sanitizer());

const url = process.env.db_url || "mongodb://localhost/LMS1";
mongoose.connect(url, {useNewUrlParser : true, useUnifiedTopology: true,});

mongoose.set('useFindAndModify', false);


//PASSPORT CONFIGURATION

app.use(require("express-session") ({ //must be declared before passport session and initialize method
    secret : "Wubba lubba dub dub",
    saveUninitialized : false,
    resave : false
}));
app.use(flash());

app.use(passport.initialize()); //must declared before passport.session()
app.use(passport.session());

passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use(function(req, res, next) {
   res.locals.currentUser   = req.user;
   res.locals.error         = req.flash("error");
   res.locals.success       = req.flash("success");
   res.locals.warning       = req.flash("warning"); 
   next();
});



//photo upload
app.post("/user/:page/image", middleware.isLoggedIn, middleware.upload.single("image"), (req, res) => {
  User.findById(req.user._id, (err, foundUser) => {
    if(err) throw err;
    
    const imagePath = path.join(__dirname, '/public/image/profile/');
    if(fs.existsSync(imagePath+foundUser.image)) {
        deleteImage(imagePath+foundUser.image);
    }
    
    const fileUpload = new resize(imagePath);
    if (!req.file) {
      res.status(401).json({error: 'Please provide an image'});
     }
    const filename = fileUpload.save(req.file.buffer);
    foundUser.image = filename;
    foundUser.save();
    
    const activity = {
            category : "Update/Upload Photo",
            user_id : {
              id : req.user._id,
             }
          };
    Activity.create(activity, (err, newActivity) => {
      if(err) {
          console.log("Failed to log activity at upload photo");
          return res.redirect("back");
      }
      res.redirect("/user/1/profile");
    });
    
  });
});

//user -> delete profile
app.delete("/user/1/delete-profile", middleware.isLoggedIn, (req, res) => {
   User.findByIdAndRemove(req.user._id, (err, foundUser) => {
        if(err) {
            console.log("Failed to find user at delete profile");
            return res.redirect("back");
        } else {
          
        const imagePath = path.join(__dirname, '/public/image/profile/');
        if(fs.existsSync(imagePath+foundUser.image)) {
            deleteImage(imagePath+foundUser.image);
        }
         
        Issue.deleteMany({"user_id.id" : foundUser._id}, (err, foundIssues) => {
            if(err) {
               console.log("Failed to find all issues related to this user at delete profile");
               return res.redirect("back");
            } else {
               Comment.deleteMany({"author.id" : foundUser._id}, (err, foundComments) => {
                  if(err) {
                     console.log("Failed to find all comments related to this user at delete profile");
                     return res.redirect("back");
                  } else {
                     Activity.deleteMany({"user_id.id" : foundUser._id}, (err, foundActivities) => {
                        if(err) {
                           console.log("Failed to find all activities of this user at delete profile");
                           return res.redirect("back");
                        } else {
                           res.redirect("/");
                        }
                     });
                  }
               });
            }
         });
      }
   });
});

//admin -> delete user
app.get("/admin/users/delete/:user_id", middleware.isAdmin, (req, res) => {
    User.findByIdAndRemove(req.params.user_id, (err, deletedUser) => {
       
    if(err) {
      console.log("Failed to find user at /admin/users/delete/:user_id GET");
      return res.redirect("back");
    }
       
    const imagePath = path.join(__dirname, '/public/image/profile/');
    if(fs.existsSync(imagePath+deletedUser.image)) {
        deleteImage(imagePath+deletedUser.image);
    }
       
    Issue.deleteMany({"user_id.id" : deletedUser._id}, (err)=> {
        if(err) {
            console.log("Failed to found issues at /admin/users/delete/:user_id GET");
            return res.redirect("back");
        }
        Comment.deleteMany({"author.id" : deletedUser._id}, (err) => {
            if(err) {
                console.log("Failed to find all comments related to this user at /admin/users/delete/:user_id GET");
                return res.redirect("back");
            } 
              
            Activity.deleteMany({"user_id.id" : deletedUser._id}, (err) => {
                  
                if(err) {
                    console.log("Failed to find all activities related to this user at /admin/users/delete/:user_id GET");
                    return res.redirect("back");
                }
                req.flash("success", "An user named " + deletedUser.firstName + " " + deletedUser.lastName + " is just deleted!");
                res.redirect("/admin/users/1"); 
              });
          });
      });
    });
});



//Routes
app.use(userRoutes);
app.use(adminRoutes);
app.use(bookRoutes);
app.use(authRoutes);

function deleteImage(imagePath, next) {
    fs.unlink(imagePath, (err) => {
      if (err) {
         console.log("Failed to delete image at delete profile");
         return next(err);
      }
  });
}

app.listen(3007, () =>{
   console.log("LMS server is running..."); 
});
    