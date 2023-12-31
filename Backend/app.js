const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');

const secretKey = crypto.randomBytes(64).toString('hex');


const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Database connection
mongoose.connect('mongodb://localhost:27017/houserent', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'));
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  usertype: String,
});

const User = mongoose.model('User', userSchema);

// Property Owner Schema
const propertyOwnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  contactRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },

  // owner: {
  //   type: String,
  //   required: true
  // },
});

const PropertyOwner = mongoose.model('PropertyOwner', propertyOwnerSchema);

// Property Schema
const propertySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyOwner', required: true },
  rent: { type: Number, required: true },
  contact: {type:Number , required:true},
  area: { type: String, required: true },
  place: { type: String, required: true },
  amenities: [String],
  status: { type: String, enum: ['Available', 'Occupied'], default: 'Available' },
});

const Property = mongoose.model('Property', propertySchema);

// Tenant Schema
const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const Tenant = mongoose.model('Tenant', tenantSchema);

app.post('/register', async (req, res) => {
  const { username, password, usertype } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = new User({ username, password: hashedPassword, usertype });
    await user.save();

    if (usertype === 'tenant') {
      const tenant = new Tenant({ name: username, email: req.body.email, password: hashedPassword  });
      await tenant.save();
    } else if (usertype === 'owner') {
      const propertyOwner = new PropertyOwner({ name: username, email: req.body.email, password: hashedPassword });
      await propertyOwner.save();
    }

    const token = jwt.sign({ userId: user._id }, secretKey);
    res.json({ token });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/login', async (req, res) => {
  const { username, password, usertype } = req.body;

  try {
    const user = await User.findOne({ username, usertype });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, secretKey);
    res.json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Routes for Property Owners
app.post('/property-owners/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the email is already registered
    const existingOwner = await PropertyOwner.findOne({ email });
    if (existingOwner) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new property owner
    const propertyOwner = new PropertyOwner({
      name,
      email,
      password: hashedPassword,
    });

    await propertyOwner.save();
    res.status(201).json(propertyOwner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/property-owners/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findOne({ email });
    if (!propertyOwner) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare the passwords
    const isPasswordValid = await bcrypt.compare(password, propertyOwner.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create a JWT token
    const token = jwt.sign({ ownerId: propertyOwner._id }, secretKey);

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes for Property Owners
app.get('/property-owners', async (req, res) => {
  try {
    const propertyOwners = await PropertyOwner.find().lean();
    res.json(propertyOwners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes for Property Owners
// app.get('/property-owners/:id/contact-email', async (req, res) => {
//   try {
//     const ownerId = req.params.id;

//     // Retrieve the owner's contact email by the owner's ID
//     const propertyOwner = await PropertyOwner.findById(ownerId).lean();

//     if (!propertyOwner) {
//       return res.status(404).json({ error: 'Property owner not found' });
//     }

//     const contactEmail = propertyOwner.email;

//     res.json({ contactEmail });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


app.get('/property-owners/:id', async (req, res) => {
  try {
    const propertyOwner = await PropertyOwner.findById(req.params.id).lean();
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }
    res.json(propertyOwner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/property-owners', async (req, res) => {
  try {
    const propertyOwner = new PropertyOwner(req.body);
    await propertyOwner.save();
    res.status(201).json(propertyOwner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/property-owners/:ownerId/contact-request', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    const { tenantId } = req.body;

    // Verify and decode the JWT token to get the logged-in user ID
    const token = req.headers.authorization?.split(' ')[1];
    const decodedToken = jwt.verify(token, secretKey);
    const loggedUserId = decodedToken.tenantId;

    // Check if the logged-in user is the same as the tenantId provided in the request body
    if (loggedUserId !== tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Convert tenantId to ObjectId
    const tenantObjectId = mongoose.Types.ObjectId(tenantId);

    // Find the property owner
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Store the tenantId in contactRequestedBy field
    propertyOwner.contactRequestedBy = tenantObjectId;
    await propertyOwner.save();

    res.status(200).json({ message: 'Contact request sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/property-owners/:ownerId/approve-contact-request', async (req, res) => {
  try {
    const { ownerId } = req.params;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Check if there is a contact request pending
    if (!propertyOwner.contactRequestedBy) {
      return res.status(400).json({ error: 'No contact request pending' });
    }

    // Clear the contactRequestedBy field to indicate approval
    propertyOwner.contactRequestedBy = null;
    await propertyOwner.save();

    res.json({ message: 'Contact request approved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/property-owners/:id', async (req, res) => {
  try {
    const propertyOwner = await PropertyOwner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).lean();
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }
    res.json(propertyOwner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes for Property Owners
app.get('/property-owners/:id/properties', async (req, res) => {
  try {
    const ownerId = req.params.id;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Retrieve properties associated with the property owner
    const properties = await Property.find({ owner: ownerId }).lean();
    res.json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Middleware to verify the JWT and extract the user ID
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId; // Add the user ID to the request object
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

app.get('/current-owner', verifyToken, async (req, res) => {
  try {
    const ownerId = req.userId; // Assuming the JWT payload contains the owner's ID

    // Retrieve the owner's information by ID
    const propertyOwner = await PropertyOwner.findById(ownerId).lean();

    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Fetch the property associated with the owner
    const property = await Property.findOne({ owner: ownerId }).lean();

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ owner: propertyOwner, property });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/property-owners/:ownerId/properties/:propertyId', async (req, res) => {
  try {
    const { ownerId, propertyId } = req.params;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Retrieve the property by property ID and validate if it belongs to the property owner
    const property = await Property.findOne({ _id: propertyId, owner: ownerId }).lean();
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/property-owners/:id/properties', async (req, res) => {
  try {
    const ownerId = req.params.id;
    const {contact, rent, area, place, amenities } = req.body;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Create a new property with the correct owner value
    const property = new Property({
      owner: ownerId,
      contact,
      rent,
      area,
      place,
      amenities,
    });

    await property.save();
    res.status(201).json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/property-owners/:ownerId/properties/:propertyId', async (req, res) => {
  try {
    const { ownerId, propertyId } = req.params;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Update the property by property ID and validate if it belongs to the property owner
    const updatedProperty = await Property.findOneAndUpdate(
      { _id: propertyId, owner: ownerId },
      req.body,
      { new: true }
    ).lean();
    if (!updatedProperty) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(updatedProperty);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/property-owners/:ownerId/properties/:propertyId', async (req, res) => {
  try {
    const { ownerId, propertyId } = req.params;

    // Check if the property owner exists
    const propertyOwner = await PropertyOwner.findById(ownerId);
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }

    // Delete the property by property ID and validate if it belongs to the property owner
    const deletedProperty = await Property.findOneAndDelete({ _id: propertyId, owner: ownerId }).lean();
    if (!deletedProperty) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(deletedProperty);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Routes for Properties
app.get('/properties', async (req, res) => {
  try {
    const properties = await Property.find().lean();
    res.json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// app.get('/properties/:id', async (req, res) => {
//   try {
//     const property = await Property.findById(req.params.id).lean();
//     if (!property) {
//       return res.status(404).json({ error: 'Property not found' });
//     }
//     res.json(property);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

app.get('/property-owners/:id', async (req, res) => {
  try {
    const propertyOwner = await PropertyOwner.findById(req.params.id).lean();
    if (!propertyOwner) {
      return res.status(404).json({ error: 'Property owner not found' });
    }
    res.json(propertyOwner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// app.post('/properties', async (req, res) => {
//   try {
//     const property = new Property(req.body);
//     await property.save();
//     res.status(201).json(property);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
app.post('/properties', async (req, res) => {
  try {
    const { owner, rent,contact, area, place, amenities } = req.body;

    // Retrieve the property owner document
    const propertyOwner = await PropertyOwner.findOne({ name: owner });

    if (!propertyOwner) {
      return res.status(400).json({ error: 'Invalid property owner' });
    }

    // Create a new property with the correct owner value
    const property = new Property({
      owner: propertyOwner._id, // Assign the owner _id
      contact,
      rent,
      area,
      place,
      amenities,
    });

    await property.save();
    res.status(201).json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




app.put('/properties/:id', async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes for Tenants
app.post('/tenants/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the email is already registered
    const existingTenant = await Tenant.findOne({ email });
    if (existingTenant) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new tenant
    const tenant = new Tenant({
      name,
      email,
      password: hashedPassword,
    });

    await tenant.save();
    res.status(201).json(tenant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/tenants/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the tenant exists
    const tenant = await Tenant.findOne({ email });
    if (!tenant) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare the passwords
    const isPasswordValid = await bcrypt.compare(password, tenant.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create a JWT token
    const token = jwt.sign({ tenantId: tenant._id }, secretKey);

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find().lean();
    res.json(tenants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/tenants', async (req, res) => {
  try {
    const tenant = new Tenant(req.body);
    await tenant.save();
    res.status(201).json(tenant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
