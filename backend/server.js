require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const cors = require("cors");
const uuid = require("uuid").v4;
const config = require("../config.json");
const app = express();
const port = 80;

app.use(express.json());
app.use(cors());

// AWS Configuration
AWS.config.update({
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  })

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();
const TABLE_NAME = "Products";
const BUCKET_NAME = "bhavesh-product-images";

// Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function putObject(filename,contentType){
    const command = new PutObjectCommand({
        Bucket : 'bhavesh-product-images',
        Key: `/a2-product-images/${filename}`,
        ContentType: contentType
    })
    const url = await(getSignedUrl(s3Client,command));
    return url;
}

// Add Product
app.post("/products", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    const product_id = uuid();

    let image_url = "";
    if (req.file) {
      const file_name = `${uuid()}-${req.file.originalname}`;
      await S3.upload({
        Bucket: BUCKET_NAME,
        Key: `/a2-product-images/${file_name}`,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,

      }).promise();
      image_url = `https://${BUCKET_NAME}.s3.amazonaws.com/${file_name}`;
    }
    
    const product = { product_id, name, description, price, category, stock, image_url };
    await dynamoDB.put({ TableName: TABLE_NAME, Item: product }).promise();

    res.status(201).json({ message: "Product added!", product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List Products
app.get("/products", async (req, res) => {
  try {
    const products = await dynamoDB.scan({ TableName: TABLE_NAME }).promise();
    res.json(products.Items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;
  
    try {
      // Fetch product to get image URL
      const getParams = {
        TableName: TABLE_NAME,
        Key: { product_id: id },
      };
      const product = await dynamoDB.get(getParams).promise();
  
      if (!product.Item) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      // Delete from DynamoDB
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: { product_id: id },
      };
      await dynamoDB.delete(deleteParams).promise();
  
      // Delete image from S3
      const imageUrl = product.Item.image_url;
      const imageKey = imageUrl.split("/").pop();
      const s3Params = { Bucket: BUCKET_NAME, Key: imageKey };
      await S3.deleteObject(s3Params).promise();
  
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  
  
app.listen(port,"0.0.0.0" ,() => console.log(`Server running on port ${port}`));
