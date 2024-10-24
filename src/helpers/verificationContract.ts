
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from '@mysten/sui.js/transactions';
import {
    fromB64,
} from "@mysten/sui.js/utils";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";




const PBT_PACKAGE_ID = '0x93d0628b3b4a9b5b9ebde175e8c51fa7b6296e5f9aaf5d9645eca3b17a29a111'
export const mySuiClient = new SuiClient({ url: getFullnodeUrl('testnet') })



export const getUserData = ()=> {
    let userPrivateKeyArray = new Array<number>()
    userPrivateKeyArray = Array.from(fromB64('AHvhK7acqcgXdkSR+gE5jzTFXjvWvH7hdYOesk/MR+07'))
    userPrivateKeyArray.shift() // remove the first byte
    const userKeypair = Ed25519Keypair.fromSecretKey(Uint8Array.from(userPrivateKeyArray))
    const address = userKeypair.getPublicKey().toSuiAddress()

    return {
        userKeypair,
        address
    }
}

export const VerifySignature = async (signature_final:  Uint8Array, pkey_final:  Uint8Array)=> {
    const {
        userKeypair,
    }  = getUserData()

    const targetSC : `${string}::${string}::${string}` = `${PBT_PACKAGE_ID}::signature::verify_signature_v3`

    console.log("calling smart contract...")
    console.log(targetSC)

    const tx = new TransactionBlock();
    tx.setGasBudget(2000000)
    tx.moveCall({
        target: targetSC,
        //4. And when you try to call the move function, use:
        arguments: [
            tx.pure(Array.from(signature_final)),
            tx.pure(Array.from(pkey_final)),
        ],
    })
    const response = await mySuiClient.signAndExecuteTransactionBlock({
        signer: userKeypair,
        transactionBlock: tx,
        requestType: "WaitForLocalExecution",
        options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
        },
    });

    console.log(response)
}