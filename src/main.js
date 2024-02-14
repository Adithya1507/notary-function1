import { Databases, Client, Functions } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    log("req" + req.body);
    //const collectionModified = req.body.$collectionId;
    const documentModified = "65cc8c3819ea60fce519";
    const databaseId = "65c9a8c8d176e568ab13";
    const collectionModified = "65c9a8d2705210df628f"
    // if (collectionModified === "65c9a8d2705210df628f") {
    //     if (parseInt(req.body.id) > 5) {
            try {
                // Initialize Appwrite client with the appropriate API key and project ID
                // const client = new Client();
                // client
                //     .setEndpoint('https://cloud.appwrite.io/v1')
                //     .setKey(EXTERNAL-API-KEY)
                //     .setProject(EXTERNAL_PROJECT_ID);

                // Access another project's collection
                const externalClient = new Client();
                externalClient
                    .setEndpoint('https://cloud.appwrite.io/v1')
                    .setKey(process.env.EXTERNAL_API_KEY)
                    .setProject(process.env.EXTERNAL_PROJECT_ID);

                const databases = new Databases(externalClient);

                const document = await databases.getDocument(databaseId, collectionModified, documentModified);

                // Perform actions with the document from the external project
                log("Document from external project: " + JSON.stringify(document));

                // You can continue with your logic here

            } catch (error1) {
                error('Error accessing document: ' + error1);
            }
    //     }
    // }

    return res.send("triggered");
};
