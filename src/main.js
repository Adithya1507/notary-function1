import { Databases, Client, Functions ,Account} from 'node-appwrite';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import sodium from "sodium-native";
import dotenv from "dotenv";
dotenv.config();
import crypto from 'crypto';
import { sign } from "noble-ed25519";
 


export default async ({ req, res, log, error }) => {
   
    
        const cipherText=req.body


        //function to decrypt the encrypted data
        const decryptedData=decryptObject(
        cipherText ,
        Buffer.from(process.env.NONCEHASH, "hex"),
        Buffer.from(process.env.KEY, "hex")
      
      )

        //retrieve the data from decrypted object
        const documentId_temp = decryptedData.documentId;
        const databaseId = decryptedData.databaseId;
        const collectionId_temp = decryptedData.collectionId
        const commitBucketId=process.env.commit_Bucket_Id
        const randomDocId = uuidv4(); 
       try {
          
           //get the previous hash from the collection "previousHash"
           const previousHash = await getPreviousHash(process.env.PROJECT_ID,process.env.DATABASE_ID,process.env.previousHash_CollectionId,process.env.previousHash_DocId,process.env.APPWRITE_API_KEY)
           
           //const previousHash="0000"
           log("previousHash"+previousHash)
            const externalClient = new Client();
            externalClient
            .setEndpoint('https://cloud.appwrite.io/v1')
            .setKey(process.env.EXTERNAL_API_KEY)
            .setProject(process.env.EXTERNAL_PROJECT_ID);
            const databases = new Databases(externalClient);
            let document=null;


            //try retriving the data from temp bucket from the data decrypted
             try{
               document = await databases.getDocument(databaseId, collectionId_temp, documentId_temp);
              }
              catch(error1)
              {
                log("this document does not exists in temp bucket");
                return res.send("document does not exists in the temp bucket");
              }


            
            const txIdToCheck=document.txId
            const allDocuments = await databases.listDocuments(databaseId,commitBucketId);

            // Check if txIdToCheck exists in any document's txid field
            const foundDocument = allDocuments.documents.find(document => document.txId === txIdToCheck);

            if (foundDocument) {
                log(`Document with txId ${txIdToCheck} already exists in commit bucket.`);

            } else {



              class Block {
                constructor(previousHash, transaction) {
                  this.previousHash = previousHash;
                  this.transaction = transaction;
                  this.encryptTransaction();
                  this.calculateMerkleRoot();
                  this.nonce = 0; // For simplicity, we're not implementing proof-of-work here
                }
             
                encryptTransaction() {
                  // Convert transaction object to JSON string
                  const transactionString = JSON.stringify(this.transaction);
             
                  // Generate a random 32-byte key and nonce
                  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
                  sodium.randombytes_buf(key);
                  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
                  sodium.randombytes_buf(nonce);
             
                  // Encrypt the transaction payload with XSalsa20
                  this.encryptedTransaction = Buffer.alloc(
                    transactionString.length + sodium.crypto_secretbox_MACBYTES
                  );
                  sodium.crypto_secretbox_easy(
                    this.encryptedTransaction,
                    Buffer.from(transactionString),
                    nonce,
                    key
                  );
             
                  // Generate Poly1305 authentication tag for the encrypted payload
                  this.transactionTag = Buffer.alloc(sodium.crypto_auth_BYTES);
                  sodium.crypto_auth(this.transactionTag, this.encryptedTransaction, key);
                }
             
                calculateMerkleRoot() {
                  const transactionHash = this.hash(this.encryptedTransaction);
                  this.merkleRoot = transactionHash;
                }
             
                hash(data) {
                  return crypto.createHash("blake2b512").update(data).digest("hex");
                }
              }


              //create the block with previousHash and the decryptedData
              const block= new Block(previousHash, decryptedData)
              
              //get the hash
              const hash=block.merkleRoot
             

              //sign the hash using the notary's private key
              const signedHash=signTransactionHash(hash.toString(),process.env.notary1_private_key.toString(),log)
             
              //add the transaction in commit bucket
              await databases.createDocument(databaseId, commitBucketId ,randomDocId, {
              name:document.name,
              id:document.id,
              status:"txn verified",
              txId: txIdToCheck,
              hash:hash.toString(),
              signedHash:signedHash.signTransactionHash

              });


              //delete the transaction from temp bucket
              await databases.deleteDocument(databaseId, collectionId_temp, documentId_temp);

              //update the previous hash from the collection inside notary-pool
              const updatedHash=  updateLastTransactionHash(hash,process.env.PROJECT_ID,process.env.DATABASE_ID,process.env.previousHash_CollectionId,process.env.previousHash_DocId,process.env.APPWRITE_API_KEY)
              log(`Document with txId ${txIdToCheck} does not exist in commit bucket.`);
            }
            
            
            return res.send("triggered");
} catch (error1) {
        error('Error occured: ' + error1);
        return res.send("Error: "+error1);
        }
            
};



const decryptObject = (ciphertextHex, nonceHex, key) => {
    // Decode hexadecimal strings to buffers
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const nonce = Buffer.from(nonceHex, "hex");
 
    // Decrypt the ciphertext
    const decrypted = Buffer.alloc(
      ciphertext.length - sodium.crypto_secretbox_MACBYTES
    );
    if (sodium.crypto_secretbox_open_easy(decrypted, ciphertext, nonce, key)) {
      // Parse the decrypted string back into an object
      const decryptedObj = JSON.parse(decrypted.toString());
      return decryptedObj;
    } else {
      throw new Error("Decryption failed!");
    }
  };


const getPreviousHash =async (projectId,databaseId,collectionId,docId,apikey) =>{

  const client = new Client();
   client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject(projectId)
  .setKey(apikey);
 
  const databases = new Databases(client);

  const document = await databases.getDocument(databaseId,collectionId,docId);
  return document.hash
};



async function signTransactionHash(transactionHash, privateKeyHex,log) {
  try {
    const privateKey = Buffer.from(privateKeyHex, "hex");
    const signatureBuffer = await sign(
      Buffer.from(transactionHash, "hex"),
      privateKey
    );
    // Convert the signature bytes to a hexadecimal string
    const signatureHex = signatureBuffer.reduce(
      (str, byte) => str + byte.toString(16).padStart(2, "0"),
      ""
    );
    return signatureHex;
  } catch (error1) {
    if (log) log("sign...error"+error1);
    throw new Error("Error signing transaction hash: " + error1.message);
  }
}


const updateLastTransactionHash=async(newHash,projectId,databaseId,collectionId,docId,apikey)=>{
  const client = new Client();
  client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject(projectId)
  .setKey(apikey);
  const databases = new Databases(client);
  try{
  await databases.updateDocument(
    databaseId, 
    collectionId,
    docId,
    { hash:newHash  }
);}catch(error1){log("erro1: "+error1)}
return newHash
}