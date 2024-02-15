import { Databases, Client, Functions } from 'node-appwrite';
import { v4 as uuidv4 } from 'uuid';

// Generate a random document ID

export default async ({ req, res, log, error }) => {
    log("req" + req.body);
    
    const cipherText=req.body
    const decrypt_url=process.env.decrypt-url.toString()
    log("decrypt_url"+decrypt_url)
    const data=await axios.post(decrypt_url,cipherText);
    // const documentId_temp = req.body.documentId;
    // const databaseId = req.body.databaseId;
    // const collectionId_temp = req.body.collectionId
    const documentId_temp = data.encryptObject.documentId;
    const databaseId = data.encryptObject.databaseId;
    const collectionId_temp = data.encryptObject.collectionId
    const randomDocId = uuidv4();
    //const randomDocId = uuid4().replace(/-/g, '').substring(0, 20);
            try {
               

                // Access another project's collection
                const externalClient = new Client();
                externalClient
                    .setEndpoint('https://cloud.appwrite.io/v1')
                    .setKey(process.env.EXTERNAL_API_KEY)
                    .setProject(process.env.EXTERNAL_PROJECT_ID);

                const databases = new Databases(externalClient);

                const document = await databases.getDocument(databaseId, collectionId_temp, documentId_temp);
                const txIdToCheck=document.txId
                


                const allDocuments = await databases.listDocuments(databaseId, "65cb6da52c7d440e9fe5");

                // Check if txIdToCheck exists in any document's txid field
                const foundDocument = allDocuments.documents.find(document => document.txId === txIdToCheck);
        
                if (foundDocument) {
                    // Document with txIdToCheck found
                    log(`Document with txId ${txIdToCheck} already exists in commit bucket.`);
                    
                } else {
                   

           
                    await databases.createDocument(databaseId, '65cb6da52c7d440e9fe5',randomDocId, {
                     name:document.name,
                     id:document.id,
                     status:"txn verified",
                     txId: txIdToCheck,
                
                  });

            await databases.deleteDocument(databaseId, collectionId_temp, documentId_temp);
                    log(`Document with txId ${txIdToCheck} does not exist in commit bucket.`);
                }
                log("Document from external project: " + JSON.stringify(document));

                // You can continue with your logic here

            } catch (error1) {
                error('Error accessing document: ' + error1);
            }
    //     }
    // }

    return res.send("triggered");
};
