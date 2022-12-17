function initialProcessSd(prompt, weight) {
	return `${prompt} :${weight}`;
}

function initialProcessAll(settings, prompt, weight) {
	if(settings.mode == "StableDiffusion")
		return initialProcessSd(prompt, weight);
	else return `${prompt}`;
}

//////////////

function processSd(prompt, origPrompt, weight) {
	return `${origPrompt} AND ${prompt} :${weight}`;
}

function processAll(settings, prompt, origPrompt, weight) {
	if(settings.mode == "StableDiffusion")
		return processSd(prompt, origPrompt, weight);
	else return `${origPrompt}, ${prompt}`;
}

module.exports = function(settings, prompt, origPrompt, weight, i, total) {
	if(i != 0 && !settings.noAnd)
		prompt = processAll(settings, prompt, origPrompt, weight);
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;
	else if(i == 0 && total > 1 && !settings.noAnd)
		prompt = initialProcessAll(settings, prompt, weight);

	return prompt;
}
