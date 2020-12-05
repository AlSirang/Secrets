require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const app = express();
const PORT = process.env.PORT || 3000;


app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(session({
    secret: "this is a long secreat",
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

// facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

const User = mongoose.model("User", require("./db"));

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

// API endpoints
app.get("/", (req, res) => {
    res.render("home");
});
// google auth
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });

app.get("/secrets", (req, res) => {
    User.find({},
        (err, result) => {
            if (!err) {
                if (req.isAuthenticated()) {
                    res.render("secrets", {secrets: result, display: ""});
                } else {
                    res.render("secrets", { secrets: result, display: "hidden" });
                }
            } else {
                console.log(err);
            }
        });

});
app.route("/submit")
    .get((req, res) => {
        if (req.isAuthenticated()) {
            res.render("submit");
        } else {
            res.redirect("/login");
        }
    })
    .post((req, res) => {
        const secret = req.body.secret;
        User.findOneAndUpdate({ _id: req.user.id }, { $set: { secret: secret } },
            (err, result) => {
                if (!err) {
                    res.redirect("/secrets");
                } else {
                    res.render("/submit");
                    console.log(result);
                }
            });
    });


// facebook auth
app.get('/auth/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

// register route
app.route("/register").
    get((req, res) => {
        res.render("register", { Msg: " " });
    })
    .post((req, res) => {
        const username = req.body.username,
            password = req.body.password;
        if (username && password) {
            User.findOne({ username: username }, (err, foundUser) => {
                if (!err) {
                    if (!foundUser) {
                        User.register({ username: username }, password, (err, user) => {
                            if (!err) {
                                passport.authenticate("local")(req, res, function () {
                                    res.redirect("/secrets");
                                });
                            } else {
                                console.log(err);
                                res.redirect("/register");
                            }
                        });
                    } else {
                        res.render("register", { Msg: "Email is already used." });
                    }
                } else {
                    console.log(err);
                    res.render("register", { Msg: "Please try to register later." });
                }
            })
        } else {
            res.render("register", { Msg: "Please Fill all inputs." });
        }
    });

// login route
app.route("/login")
    .get((req, res) => {
        res.render("login", { Msg: "" });
    }).post((req, res) => {
        const username = req.body.username,
            password = req.body.password;
        if (username && password) {
            const user = new User({
                username,
                password,
            });
            req.login(user, (err) => {
                if (!err) {
                    passport.authenticate("local", { failureRedirect: "/login" })(req, res, function () {
                        res.redirect("/secrets");
                    });
                } else {
                    console.log(err);
                    res.redirect("/login");
                }
            })
        } else {
            res.render("login", { Msg: "Please Fill all inputs." });
        }
    });


app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login');
});

const uri = "mongodb://localhost:27017/usersDB";
const configs = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
};
mongoose.connect(uri, configs,
    (err) => {
        if (!err) {
            console.log("Connected to DB Successfully.");
            app.listen(PORT, () => {
                console.log(`Server is active at http://localhost:${PORT}`);
            });
        } else {
            console.error(err.message);
        }
    });

