const PizZip = require('pizzip');
const DocxTemplater = require('docxtemplater');
const supportFunctions = require('./supportFunctions');

const startGenerate = (fileContent, replacedAttributes)=>{
	const zip = new PizZip(fileContent);
	let doc;
	try {
		doc = new DocxTemplater(zip, {
			linebreaks: true,
			parser: function(tag) {
				// tag is "user"
				return {
					'get': function(scope) {
						let supportFunction;
	
						//console.log('get parser', tag);
						for (var i = supportFunctions.length - 1; i >= 0; i--) {
							let regexp = new RegExp(supportFunctions[i].regexp, "g");
	
							if (regexp.test(tag)) {
								supportFunction = supportFunctions[i];
								break;
							}
						}
	
						if (supportFunction) {
							//console.log('supportFunction: ', supportFunction.name, tag);
							return supportFunction.func.call(supportFunction, tag, scope);
						} else if (tag === '.') {
							return scope;
						} else {
							// Here we return the property "user" of the object {user: "John"}
							return scope[tag];
						}
					}
				};
			},
			nullGetter: function(part) {
				// return part.value;
				return '';
			}
		});
	} catch(error) {
		// Catch compilation errors (errors caused by the compilation of the template : misplaced tags)
		let errorMessages = 'Cannot generate document using DocxTemplater';
		if (error.properties && error.properties.errors instanceof Array) {
			errorMessages = error.properties.errors.map(function (error) {
				return error.properties.explanation;
			}).join("\n");
		}
		return {
			type: 'error',
			message: errorMessages,
			error
		}
	}

	doc.setData(replacedAttributes);
	try {
		doc.render();
	}
	catch (error) {
		let e = {
			message: error.message,
			name: error.name,
			stack: error.stack,
			properties: error.properties,
		}
		// console.log(JSON.stringify({error: e}));
		//throw error;
		return {
			type: 'error',
			message: error.message,
			error
		}
	}
	let buf = doc.getZip().generate({type: 'nodebuffer'});
	return buf;
}

function replaceErrors(key, value) {
    if (value instanceof Error) {
        return Object.getOwnPropertyNames(value).reduce(function(error, key) {
            error[key] = value[key];
            return error;
        }, {});
    }
    return value;
}

module.exports = startGenerate;