const supportFunctions = [{
	name: "isEqual",
	regexp:"isEqual\\(([^,]*),([^\\)]*)\\)",
	func: function(tag, scope){
		let regexp = new RegExp(this.regexp, "g");
		let attributeKey = tag.replace(regexp, "$1");
    let conditionString = tag.replace(regexp, "$2");

  	if(attributeKey && conditionString){
  		let value = scope[attributeKey];
  		let result = false;
  		let conditions = conditionString.split('||');

		conditions.forEach(item =>{
			result = result || (value == item);
		});

  		return result;
  	} else {
  		return false;
  	}
	}
},{
	name: "isNotEqual",
	regexp:"isNotEqual\\(([^,]*),([^\\)]*)\\)",
	func: function(tag, scope){
		let regexp = new RegExp(this.regexp, "g");
		let attributeKey = tag.replace(regexp, "$1");
  	let conditionString = tag.replace(regexp, "$2");

  	if(attributeKey && conditionString){
  		let value = scope[attributeKey];
  		let result = true;
  		let conditions = conditionString.split('&&');

		conditions.forEach(item =>{
			result = result && (value != item);
		});

  		return result;
  	} else {
  		return false;
  	}
	}
},{
  name: "isContains",
  regexp:"isContains\\(([^,]*),([^\\)]*)\\)",
  func: function(tag, scope){
    let regexp = new RegExp(this.regexp, "g");
    let attributeKey = tag.replace(regexp, "$1");
    let conditionString = tag.replace(regexp, "$2");
    let value = scope[attributeKey];

    if(value && conditionString){
      let conditions, result;
      if(conditionString.includes('&&')){
        conditions = conditionString.split('&&');

        result = true;
        conditions.forEach(item =>{
          result = result && value.includes(item);
        })
      } else if(conditionString.includes('||')){
        conditions = conditionString.split('||');

        conditions.forEach(item => {
          result = result || value.includes(item);
        })
      } else {
        result = value.includes(conditionString);
      }

      return result;
    } else {
      return false;
    }
  }
}];

module.exports = supportFunctions;