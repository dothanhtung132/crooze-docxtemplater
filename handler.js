'use strict';

const BoxSDK = require('box-node-sdk');

const response = require('./common/response');
const getRequestParams = require('./common/getRequestParams');
const createBoxFolder = require('./box/createBoxFolder');
const filenameFromAttrs = require('./common/filenameFromAttrs');
const readBoxStream = require('./box/readBoxStream');
const startGenerate = require('./startGenerate');
const uploadStreamToBox = require('./box/uploadStreamToBox');
const addMetadata = require('./box/addMetadata');
const httpsPost = require('./common/httpsPost');

const ORIGIN = process.env.ORIGIN;
const CALLBACK_PATH = process.env.CALLBACK_PATH;
const GIT_INFO = process.env.GIT_INFO;

const headers = {
	'Access-Control-Allow-Origin': '*'
}

const boxSdk = new BoxSDK({clientID: '', clientSecret: ''});

module.exports.generateDocument = async (event, context) => {
	let requestParams = getRequestParams(event)
	//console.log('requestParams', requestParams);

	let origin = ORIGIN;
	let reqHeaders = event.headers;
	if(origin=='*' && reqHeaders){
		origin = reqHeaders['origin'] || reqHeaders['Origin'];
	}

	let {item: currentItem, formData, targetFolder, uploadFolderName, selectedFileNameAttributes, addMetadataToFile, addMetadataToFolder, templateKey} = requestParams;

	targetFolder = targetFolder || requestParams.folderData//folderData for crooze form

	if(!currentItem || !currentItem.token || !formData || !targetFolder.token) return response.responseError({message: 'Invalid request', version: GIT_INFO}, 400, headers);
	let itemId = currentItem.id;
	let boxClientCurrentItem = boxSdk.getBasicClient(currentItem.token);
	let fileContent = await readBoxStream(boxClientCurrentItem, itemId);
	if(fileContent.ype == 'error') return response.responseError(fileContent.message, 400, headers);

	let boxClientTargetFolder = boxSdk.getBasicClient(targetFolder.token);
	
	let folderId = targetFolder.id || targetFolder.boxid;//folderData for crooze form
	let uploadFolderId = folderId;

	let fileName = filenameFromAttrs(selectedFileNameAttributes, formData, currentItem);

	let folderInfo;
	//console.log('uploadFolderName', uploadFolderName)
	if(uploadFolderName){
		let folderName = formData[uploadFolderName] || uploadFolderName;
		folderInfo = await createBoxFolder(folderId, folderName, boxClientTargetFolder);
		if(folderInfo.type == 'error'){
			console.log(`Create Folder ${folderName} failed with error:`, folderInfo);
		}else{
			uploadFolderId = folderInfo.id;
			if(addMetadataToFolder){
				let folderMetadata = await addMetadata(folderInfo, templateKey, formData, boxClientTargetFolder);
				if(folderMetadata.type == 'error'){
					console.log(`Add metadata to folder ${folderInfo.name}(${folderInfo.id}) failed with error`, folderMetadata);
				}else{
					folderInfo.metadata = folderMetadata;
				}
			}
		}
	}

	let docBuff = startGenerate(fileContent, formData);
	if(docBuff.type == 'error') return response.responseError(docBuff.message, 400, headers);

	let fileData = await uploadStreamToBox(uploadFolderId, fileName, docBuff, boxClientTargetFolder);
	if(fileData.type == 'error'){
		if(fileData.code != 'item_name_in_use') return response.responseError(fileData.message, 400, headers);
		let filenameSplit = fileName.split('.');
		let ext = `.${filenameSplit.pop()}`;
		fileName = filenameSplit.join('.');

		let indexCount = 1;
		do{
			let newName = `${fileName} ${indexCount}${ext}`;
			fileData = await uploadStreamToBox(uploadFolderId, newName, docBuff, boxClientTargetFolder);
			indexCount++;
		}while(fileData.type == 'error' && fileData.code == 'item_name_in_use' && indexCount < 50);

		if(fileData.type == 'error') return response.responseError(fileData.message, 400, headers);
	}

	let fileInfo = fileData.entries[0];
	if(addMetadataToFile){
		await addMetadata(fileInfo, templateKey, formData, boxClientTargetFolder);
	}
	//console.log('fileInfo: ', fileInfo);

	//call back to Crooze To update file info
	let message = `"${fileInfo.name}" has been created and has been added to Box`;
	let cbURL = origin + CALLBACK_PATH.replace('{id}', requestParams.processId);
	//console.log({message, expiresAt: 5, complete: true, data: {uploadFormId: requestParams.uploadFormId, file: {id: fileInfo.id, name: fileInfo.name} }});
	await httpsPost(cbURL, 'POST', {message, expiresAt: 5, complete: true, data: {uploadFormId: requestParams.uploadFormId, file: {id: fileInfo.id, name: fileInfo.name} }}).catch(err=>{
			console.log(`Call to ${cbURL} failed`, err);
			return err;
		});

	//return data after process completed
	let responseData = response.responseSuccess({
			type: 'success',
			message: 'generate document success',
			file: fileInfo,
			folder: folderInfo
	}, 200, headers);

	return responseData;
};

