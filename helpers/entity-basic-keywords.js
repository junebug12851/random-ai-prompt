const _ = require("lodash");

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

module.exports = function() {
	let prompt = "";

	let emotion = false;
	let human = false;

	switch(_.random(0, 6, false)) {
		case 0:
			prompt += ` {animal}`;
			emotion = true;
			break;
		case 1:
			prompt += ` {d-character}`;
			emotion = true;
			human = true;
			break;
		case 2:
			prompt += ` ${maybeAddColor()}{flower}`;
			break;
		case 3:
			prompt += ` {instrument}`;
			break;
		case 4:
			prompt += ` {mythological-creature}`;
			emotion = true;
			break;
		case 5:
			prompt += ` {tree}`;
			break;
		case 6:
			prompt += ` person`;
			emotion = true;
			human = true;
			break;
	}

	if(_.random(0.0, 1.0, true) < 0.5 && emotion)
		prompt += ", {emotion}"

	if(_.random(0.0, 1.0, true) < 0.5 && human)
		prompt += `, ${maybeAddColor()}{hair}`

	const clothingCount = (_.random(0.0, 1.0, true) < 0.5 && human) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < clothingCount; i++) {
		prompt += `, ${maybeAddColor()}{clothes}`;
	}

	return prompt;
}
