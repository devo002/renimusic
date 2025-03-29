require("dotenv").config();

const express = require("express");
const compression = require("compression");
const chalk = require("chalk");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const logger = require("morgan");
const ejs = require("ejs");
const MongoStore = require("connect-mongo")(session);
const mongoSanitize = require("express-mongo-sanitize");
const flash = require("connect-flash");
const passport = require("passport");
require("./config/passport.config")(passport);
const mongoose = require("mongoose");
const helmet = require("helmet");
const xss = require("xss-clean");
const nodemailer = require('nodemailer');
// const db = require("./config/config");

// global variables 
const { gloabalVariables } = require("./config/global.config");

const { errorHandler } = require("./middlewares/errorHandler")

const app = express();

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				...helmet.contentSecurityPolicy.getDefaultDirectives(),
				"default-src": ["'self'",],
				"img-src": ["'self'", "https://res.cloudinary.com/", "https://www.gravatar.com/"],
				// "img-src": ["'self'", "https://www.gravatar.com/"], //https://www.gravatar.com/
				"frame-src": ["'self'", "https://www.youtube.com/"],
				"font-src": ["'self'", "https://fonts.googleapis.com/"],
				"style-src-elem": ["style-src 'self' 'unsafe-inline'", "https://maps.google.com"]
				// Security Policy directive: "img-src 'self' https://res.cloudinary.com/"
			},
		},
	})
);


app.use(cors({ credentials: true, origin: 'https://www.renimusic.com' }));

app.use(compression());

// require("./config/db.config")(dbConfig)
mongoose.connect(`${process.env.MONGO_URI}`, {
	useCreateIndex: true,
	useUnifiedTopology: true,
	useNewUrlParser: true
})
.then((con) => {
	console.log(chalk.gray(`\t\tDatabase connected successfully !!!!!!`));
})
.catch((err) => {
	console.log(chalk.redBright(`\t\tDatabase connection failed ${err}`));
})

// morgan
app.use(logger("dev"));
app.use(cookieParser());

// configuring express
app.use(express.static(path.join(__dirname, "public")));

// setting up the template engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// body-parser 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({limit:"1mb"}));

app.use(mongoSanitize());
// Data Sanitization against XSS attacks
app.use(xss());

// express session middleware
app.use(session({
	secret: `${process.env.COOKIE_SECRET}`,
	resave: false, 
	saveUninitialized: false,
	cookie: { secure: false, maxAge: Date.now() + 60000},//24hours
	store: new MongoStore({
		mongooseConnection: mongoose.connection,
		ttl: 600 * 6000
	})
	
}))

// preventing DOS attacks
const limit = rateLimit({
    max: 100,// max requests
    windowMs: 60 * 60 * 1000, // 1 Hour
    message: 'Too many requests' // message to send
});

// passport middleware 
app.use(passport.initialize());
app.use(passport.session());

// connect flash
app.use(flash());

// global environment 
app.use(gloabalVariables);

// ROUTES
// default //
const defaultRoutes = require("./routes/defaultRoutes/default.routes");
// ADMIN //
const adminRoutes = require("./routes/admin/admin.routes");
/**
 * @params {*auth} req
*/
const authRoutes = require("./routes/auth/auth.routes");
const { isAdmin } = require("./config/custom.config");

// const dbConfig = require("./config/db.config");

// initiallizing routes
// initializes default //
app.use("/", defaultRoutes);
/**
* @param {*ADMIN} Route
*/
app.use("/admin", limit, isAdmin, adminRoutes);
/**
* @param {*AUTH} Route
*/
app.use("/auth", authRoutes);

app.get('/', (req,res)=>{
	res.render('/contact');
});

app.post('/contact_me', (req, res) => {
	const { name, phone, email, subject, message } = req.body;
        console.log(req.body);
 
        const output = `
        <p>You have a new contact request</p>
        <h3>Contact Details</h3>
        <ul>  
          <li>Name: ${req.body.name}</li>
          <li>Subject: ${req.body.subject}</li>
          <li>Email: ${req.body.email}</li>
          <li>Phone: ${req.body.phone}</li>
        </ul>
        <h3>Message</h3>
        <p>${req.body.message}</p>
      `;
    
      // create reusable transporter object using the default SMTP transport
      let transporter = nodemailer.createTransport({
        service:'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: 'drrenimusic@gmail.com', // generated ethereal user
            pass: 'Drrenimusic00'  // generated ethereal password
        },
        tls:{
          rejectUnauthorized:false
        }
      });
    
      // setup email data with unicode symbols
      let mailOptions = {
          from: '"Nodemailer Contact" drrenimusic@gmail.com', // sender address
          to: 'drrenimusic@gmail.com', // list of receivers
          subject: 'Node Contact Request', // Subject line
          text: 'Hello world?', // plain text body
          html: output // html body
      };
    
      // send mail with defined transport object
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              return console.log(error);
          }
          console.log('Message sent: %s', info.messageId);   
          console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    
          res.redirect("/contact", {msg:'Email has been sent'});
      });
      }
    
	);

// error handlers
app.use(errorHandler);

app.listen(process.env.PORT || 9000, () => {
    console.log(chalk.blue("\t\tExpress server listening on port %d in %s mode", process.env.PORT, app.settings.env));
})
