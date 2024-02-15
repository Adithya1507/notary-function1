import { Databases, Client, Functions } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    log("req" + req.body);
    //const collectionModified = req.body.$collectionId;
    const documentId_temp = req.body.documentId;
    const databaseId = req.body.databaseId;
    const collectionId_temp = req.body.collectionId
   
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
                    log(`Document with txId ${txIdToCheck} exists in commit bucket.`);
                    
                } else {
                    await databases.deleteDocument(databaseId, collectionId_temp, documentId_temp);

           
                    await databases.createDocument(databaseId, '65cb6da52c7d440e9fe5',"123", {
                     name:document.name,
                     id:document.id,
                     status:document.status,
                     txId: txIdToCheck,
                
            });
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
