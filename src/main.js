import { Databases, Client, Functions } from 'node-appwrite';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
// Generate a random document ID

export default async ({ req, res, log, error }) => {
    log("req" + req.body);
    
    const cipherText=req.body
    const decrypt_url=process.env.decrypt_url
    const payload={
        "objToDecrypt": cipherText
    }
    const decryptedData=await axios.post(decrypt_url,payload);
  
    const documentId_temp = decryptedData.data.encryptObject.documentId;
    const databaseId = decryptedData.data.encryptObject.databaseId;
    const collectionId_temp = decryptedData.data.encryptObject.collectionId
    const commitBucketId=process.env.commit_Bucket_Id
    const randomDocId = uuidv4(); 
    try {
       
            const externalClient = new Client();
            externalClient
            .setEndpoint('https://cloud.appwrite.io/v1')
            .setKey(process.env.EXTERNAL_API_KEY)
            .setProject(process.env.EXTERNAL_PROJECT_ID);

            const databases = new Databases(externalClient);

            const document = await databases.getDocument(databaseId, collectionId_temp, documentId_temp);
            const txIdToCheck=document.txId
            const allDocuments = await databases.listDocuments(databaseId,commitBucketId);

            // Check if txIdToCheck exists in any document's txid field
            const foundDocument = allDocuments.documents.find(document => document.txId === txIdToCheck);

            if (foundDocument) {
                log(`Document with txId ${txIdToCheck} already exists in commit bucket.`);

            } else {
                await databases.createDocument(databaseId, commitBucketId ,randomDocId, {
                name:document.name,
                id:document.id,
                status:"txn verified",
                txId: txIdToCheck,

                });

                await databases.deleteDocument(databaseId, collectionId_temp, documentId_temp);
                log(`Document with txId ${txIdToCheck} does not exist in commit bucket.`);
            }
            
            return res.send("triggered");
       

        } catch (error1) {
        error('Error accessing document: ' + error1);
        return res.send("Not added to commit bucket"+error1);
        }
            
};
