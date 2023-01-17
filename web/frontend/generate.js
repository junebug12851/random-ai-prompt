// Settings
let settings = {};
let lists = [];
let state = {};

// Save state
function saveSetting(path, value) {

	// Save into state
	if(value == "")
		state[path] = undefined;
	else
		state[path] = value;

	// Save into local storage
	localStorage.setItem('generateSettings', JSON.stringify(state));
}

// Converts to start case but fixes numbering
function startCase(text) {
	let ret = _.startCase(text);

	// Replace D with Danbooru (More readable)
	ret = ret.replace(/^D /m, "Danbooru ");

	// Replace Danbooru with anime to be more readable
	ret = ret.replace("Danbooru", "Anime");

	ret = ret.replace("Dhigh", "Digipa High");
	ret = ret.replace("Dmed", "Digipa Medium");
	ret = ret.replace("Dlow", "Digipa Low");

	// Makes it too long, skip, was to add to readability
	// ret = ret.replace("Danbooru Character C", "Danbooru Character Trademark");
	// ret = ret.replace("Danbooru Character Nc", "Danbooru Character OC");

	// 3 D Print V 1 => 3D Print V1
	ret = ret.replaceAll(/(\d) (\w)/gm, "$1$2");
	ret = ret.replaceAll(/(\w) (\d)/gm, "$1$2");

	return ret;
}

function returnValToSetting() {

	// Ignore if invalid
	if($(this).is(":invalid"))
		return;

	// Get cmd(s)
	const paths = $(this).data('command').split(",");

	// Get the value
	let val;

	if($(this).is('[type="checkbox"]'))
		val = $(this).prop('checked').toString();
	else
		val = $(this).val();

	// Convert value to an array of 1 or more elements only if this is a text input or textarea
	// and it's either implicitly or explicitly requested
	if(
		(paths.length > 1 || $(this).data('join') != undefined) &&
		($(this).is("input[type='text']") || $(this).is("textarea"))
	) {
		if($(this).data('join') != undefined)
			val = val.split($(this).data('join'));
		else
			val = val.split("-");
	}

	// Otherwise just make into an array
	else
		val = [val];

	// Type conversion from string to proper primitive values
	for(let i = 0; i < val.length; i++) {

		// Try to convert to null
		if(val[i] == "null") {
			val[i] = null;
		}

		// Try t convert to undefined
		else if(val[i] == "undefined") {
			val[i] = undefined;
		}

		// Try to convert to a boolean
		else if(val[i] == "true" || val[i] == "false") {
			val[i] = (val[i] == "true");
		}

		// Try to convert to number
		else if(!isNaN(Number(val[i]))) {
			val[i] = Number(val[i]);
		}

		// Try to convert it to a float
		else if(val[i].endsWith("%") && !isNaN(Number.parseFloat(val[i]))) {
			val[i] = Number.parseFloat(val[i]);
			val[i] = +(val[i] * 0.01).toFixed(2);
		}

		// Leave as a string
	}

	// Save

	// 1 path to 1 value
	if(paths.length == 1 && val.length == 1) {
		saveSetting(paths[0], val[0]);
		return;
	}

	// 1 path to an array value
	else if(paths.length == 1 && val.length > 1) {
		saveSetting(paths[0], val);
		return;
	}

	// 1 value per path
	else if(val.length == paths.length) {

		for(let i = 0; i < paths.length; i++) {

			// Grab path
			const path = paths[i];

			// Grab value
			const value = val[i];

			// Save
			saveSetting(path, value);
		}

		return;
	}

	console.error("Can't classify how to save data back, paths", paths, "values", val);
}

async function updateInsertMenu() {

	// Gather files
	let dynPrompts = await ajaxGet('/api/files/dynamic-prompts');
	if(dynPrompts == null || dynPrompts == undefined)
		dynPrompts = [];

	let expansions = await ajaxGet('/api/files/expansions');
	if(expansions == null || expansions == undefined)
		expansions = [];

	let lists = await ajaxGet('/api/files/lists');
	if(lists == null || lists == undefined)
		lists = [];

	let randomKeywords = await ajaxGet('/api/images/random-keywords');
	if(randomKeywords == null || randomKeywords == undefined)
		randomKeywords = [];

	// ------------------------------------------------------------------------
	// Dynamic prompts full
	// ------------------------------------------------------------------------

	for(let i = 0; i < dynPrompts.fullRegular.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span title="Full dynamically generated prompts around a theme, these stand on their own and don't usually need extra prompt keywords">Full Dynamic Prompts</span>`);

		$("#keyword-cloud").append(`<button data-value="#${dynPrompts.fullRegular[i]}">${startCase(dynPrompts.fullRegular[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Dynamic prompts user-submitted
	// ------------------------------------------------------------------------

	for(let i = 0; i < dynPrompts.userFiles.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span title="Full user-submitted dynamically generated prompts around a theme, these stand on their own and don't usually need extra prompt keywords">User Dynamic Prompts</span>`);

		$("#keyword-cloud").append(`<button data-value="#${dynPrompts.userFiles[i]}">${startCase(dynPrompts.userFiles[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Lists
	// ------------------------------------------------------------------------

	for(let i = 0; i < lists.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span title="Replaced by a single random entry from the list file">Lists</span>`);

		$("#keyword-cloud").append(`<button data-value="{${lists[i]}}">${startCase(lists[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Expansions
	// ------------------------------------------------------------------------

	for(let i = 0; i < expansions.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span title="Inserts a string of text from the expansion file (Same text everytime). Expansion files can contain dynamic prompts and lists though to offer randomiation">Expansions</span>`);

		$("#keyword-cloud").append(`<button data-value="<${expansions[i]}>">${startCase(expansions[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Dynamic prompts partial
	// ------------------------------------------------------------------------

	for(let i = 0; i < dynPrompts.partialRegular.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span title="Partial prompts, these are meant to compliment other parts of a prompt but don't stand well on their own">Partial Dynamic Prompts</span>`);

		$("#keyword-cloud").append(`<button data-value="#${dynPrompts.partialRegular[i]}">${startCase(dynPrompts.partialRegular[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Dynamic prompts V1
	// ------------------------------------------------------------------------

	for(let i = 0; i < dynPrompts.v1Files.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span disabled title="Full legacy dynamically generated prompts around a theme">V1 Dynamic Prompts</span>`);

		$("#keyword-cloud").append(`<button data-value="#${dynPrompts.v1Files[i]}">${startCase(dynPrompts.v1Files[i])}</button>`);
	}

	// ------------------------------------------------------------------------
	// Random Keywords
	// ------------------------------------------------------------------------

	for(let i = 0; i < randomKeywords.length; i++) {
		if(i == 0)
			$("#keyword-cloud").append(`<span disabled title="Random keywords from images you've already generated">Random Existing Keywords</span>`);

		$("#keyword-cloud").append(`<button data-value="${randomKeywords[i]}">${startCase(randomKeywords[i])}</button>`);
	}

	$("#keyword-cloud").append(`<span title="Special prompt features">Special Features</span>`);
	$("#keyword-cloud").append(`<button data-value="{salt}" title="Forces salt/frame number to be inserted at this location in the prompt">Force salt here</button>`);
}

function insertSelected() {
	const selectedValue = $(this).data("value");

	let curText = $('#page-search').val().trim();
	if(curText == "")
		curText = selectedValue;
	else
		curText = `${curText}, ${selectedValue}`;

	$('#page-search').val(curText);
}

function presetSelected() {
	const selectedValue = $(this).val();

	let curText = $('[data-command="presets"]').val().trim();
	if(curText == "")
		curText = selectedValue;
	else
		curText = `${curText},${selectedValue}`;

	$('[data-command="presets"]').val(curText);
	$(this).prop('selectedIndex', 0);
}

async function updateSearchSuggestion() {

  const suggestion = await ajaxGet('/api/prompt-suggestion');
  $('#page-search').attr('placeholder', suggestion);

}

// Set the interval to run every 30 seconds
setInterval(updateSearchSuggestion, 15 * 1000);

function populateSettingsList() {
	// Loop through all div elements with the "option" class
  $('.option').each(function() {

    // Get the label child element
    const label = $(this).children('label');

    // Get the textarea, input, select, or checkbox child element
    let formElement = $(this).children().filter(':input').first();

    // It may be contained in .number-stepper
    if(formElement.is("button.remove"))
    	formElement = $(this).children().filter('.number-stepper').children().filter('input');

    // Get the text of the label element
    const labelText = label.text();

    // Get the value of the form element
    const formElementValue = formElement.data("command");

    // Title
    const labelTitle = label.attr('title');

    // Add the label text as an option to the select menu
    $('#add-settings').append(`<option title="${labelTitle}" value="${formElementValue}">${labelText}</option>`);
  });
}

function fillListData(el) {

	// Stop if this isn't a select box with the data-lists attribute
	if(!$(el).is("select[data-lists]"))
		return;

	// Empty out children
	$(el).empty();

	for(let i = 0; i < lists.length; i++) {
		let display = startCase(lists[i]);
		if(display == "False")
			display = "Random";

		$(el).append(`<option value="${lists[i]}">${display}</option>`);
	}
}

function fillSettingValue(el) {
	// Stop if this isn't an element with the data-path attribute
	if(!$(el).is("[data-path]"))
		return;

	const path = $(el).data('path').split(",");

	let value = _.at(settings, path);

	if(value == null || value == undefined || value.length == 0)
		return;

	if($(el).data('percent') != undefined) {
		for(let i = 0; i < value.length; i++) {
			value[i] = (+(value[i] * 100).toFixed(2)) + "%";
		}
	}

	let joinStr = "-";

	if($(el).data('join') != undefined) {
		joinStr = $(el).data('join');

		for(let i = 0; i < value.length; i++) {
			if(Array.isArray(value[i]))
				value[i] = value[i].join(joinStr);
		}
	}

	// console.log(path, value);

	if($(el).is('[type="checkbox"]'))
		$(el).prop('checked', value[0]);
	else
		$(el).val(value.join(joinStr));
}

function showSettingOnSelect() {
	$('#add-settings').change(function() {

		// Get selected value
		const selectedValue = $(this).val();

		// Skip if invalid option
		if(selectedValue == "-1")
			return;

		const inputEl = $(`[data-command="${selectedValue}"]`).first();

		// Fill list data if applicable
		fillListData(inputEl);

		// Fill-in settings value if applicable
		fillSettingValue(inputEl);

		// Set active to true
		if(inputEl.parent().is(".option"))
			inputEl.parent().attr('data-active', true);
		else {
			inputEl.parent().parent().attr('data-active', true);
		}

		// Disable selected option
		$(this)
			.find('option:selected')
			.prop('disabled', true);

		// Reset selected index
		$(this).prop('selectedIndex', 0);
	});
}

function removeSettingOnClick() {
	$('button.remove').click(function() {

		// Get values
	  let siblingInput = $(this).siblings(':input').first();

	  if(siblingInput.length == 0)
	  	siblingInput = $(this).siblings('.number-stepper').first().children().filter('input');

	  const command = siblingInput.data('command');
	  
	  // Set option to inactive
	  $(this).parent().attr('data-active', "false");

	  // Clear value
	  siblingInput.val('');

	  // Re-enable setting in select menu
	  $(`#add-settings option[value="${command}"]`).prop('disabled', false);
	});
}

async function downloadSettings() {
	const _settings = await ajaxGet('/api/settings');
	if(_settings != null && _settings != undefined)
		settings = _settings;

	const _lists = await ajaxGet('/api/files/lists');
	if(_lists != null && _lists != undefined)
		lists = _lists;
}

function addRemoveButton() {
	$(".option").attr("data-active", "false");
	$(".option").append(`<button class="remove">Remove</button>`);
}

function onMinusStepperClick(input) {
	const currentValue = +input.val();
	const step = +input.attr('step');
	input.val(currentValue - step);

	if(input.val < step)
		input.val(step);

	$(input).trigger("change");
}

function onPlusStepperClick(input) {
	const currentValue = +input.val();
	const step = +input.attr('step');
	input.val(currentValue + step);

	$(input).trigger("change");
}

function setupNumberSteppers() {
	$(".number-stepper").each(function() {
		const minusBtn = $(this).children('button:first-child');
		const input = $(this).children('input');
		const plusBtn = $(this).children('button:nth-child(3)');

		minusBtn.click(onMinusStepperClick.bind(undefined, input));
		plusBtn.click(onPlusStepperClick.bind(undefined, input));
	});
}

function onNumberChangeWStep() {

	// Get value
	let value = +$(this).val();
	const step = +$(this).attr('step');

	// If value is multiple of 64, then stop here
    const mult64Check = value % step;
    if(mult64Check === 0)
        return;

    // Convert partial multiple of 64 to percent
    const mult64Percent = mult64Check / step;

    // Round up or down to nearest multiple of 64
    if(mult64Percent >= 0.50)
        value += (step - mult64Check);
    else
        value -= mult64Check;

    // Set value
    $(this).val(value);
}

async function updatePresetMenu() {

	// Gather files
	const presets = await ajaxGet('/api/files/presets');
	if(presets == null)
		return;

	for(let i = 0; i < presets.length; i++) {
		$("#preset-insert").append(`<option value="${presets[i]}">${startCase(presets[i])}</option>`);
	}
}

function insertStoredPrompt() {

	// Get stored prompt in browser
	let prompt = localStorage.getItem('prompt');

	// Check to see if it exists and isn't an empty string
	if(prompt == "" || prompt == null || prompt == undefined)
		return;

	// Trim it
	prompt = prompt.trim();

	// Do empty string check again
	if(prompt == "")
		return;

	// Set it to the textbox
	$("#page-search").val(prompt);
}

function insertSettings(obj, useAll) {

	// Skip if null or undefined
	if(obj == null || obj == undefined)
		return;

	try {
		// Convert to JSON if string
		if(typeof obj == "string")
			obj = JSON.parse(obj);
	}
	catch(err) {

		console.error(err);

		// Skip if error
		return;
	}

	// Skip if not an object
	if(!_.isPlainObject(obj))
		return;

	// Apply settings
	_.forOwn(obj, function(value, key) {

		// Get setting with key
		let control = $(`[data-command="${key}"]`);

		if(key == "prompt")
			control = $("#page-search");

		// Make sure it's found
		if(control.length == 0) {
			console.error("data-command not found", key);
			return;
		}

		// Pick out first one
		control = $(control).first()

		// Get option group
		const optionGroup = $(control).parents(".option").first();

		// If it has the data-skip, then skip if not told to useAll
		if($(control).is("[data-skip]") && !useAll)
			return;

		// Do nothing for empty values
		if(value == "" && $(control).is("[data-command]")) {

			// Fill list data if applicable
			fillListData(control);

			// Fill-in settings value if applicable
			fillSettingValue(control);
		}
		else if(value != "") {
			
			// Set value to stored value
			if($(control).is('[type="checkbox"]'))
				$(control).prop('checked', value);
			else
				$(control).val(value);
		}

		// Enable option group
		$(optionGroup).attr("data-active", "true");

		// Disable option in menu
		$(`#add-settings option[value="${key}"]`).prop('disabled', true);
	});
}

function saveState() {

	// Clear saved state
	state = {};
	localStorage.setItem('generateSettings', "{}");

	// Save current settings
	$(`.option[data-active="true"] [data-command]`).each(returnValToSetting);

	// Save prompt
	if($("#page-search").val().trim() != "") {
		saveSetting("prompt", $("#page-search").val().trim());
	}

	localStorage.setItem('prompt', $("#page-search").val().trim());
}

function generate() {

	// Save the current state
	saveState();

	// Post it
	$.ajax({
        type: 'POST',
        url: `/api/generate-full`,
        data: JSON.stringify(state),
        contentType: 'application/json',
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  	});

    displayProgress(true);
}

function performRandomGenerate() {

    // Get random placeholder text
    let text = $('#page-search').attr('placeholder');

    // Set it as search text
    $('#page-search').val(text);

    // Generate
    generate();
}

function copyShareLink() {

	// First save state
	saveState();

	// Copy state
	const _state = _.cloneDeep(state);

	// Copy prompt and negative prompt
	const prompt = _state.prompt;
	const negativePrompt = _state["negative-prompt"];

	// Remove
	delete _state.prompt;
	delete _state["negative-prompt"];

	// Convert rest of state to url parameters

	// Then get the url to copy
	// Add useAll param to allow all settings to transfer over
	// Add urlOnly to exclude bringing in existing existing saved state
	let text = `http://localhost:7861/generate?useAll=true&urlOnly=true&${new URLSearchParams(_state).toString()}`;

	// Add prompt and negative prompt back urlencoded
	if(prompt)
		text += `&prompt=${encodeURIComponent(prompt)}`;

	if(negativePrompt)
		text += `&negative-prompt=${encodeURIComponent(negativePrompt)}`;

	// Then copy it to clipboard
    const tempInput = $('<input type="text"/>');
    $('body').append(tempInput);
    tempInput.val(text).select();
    document.execCommand('copy');
    tempInput.remove();
}

$(document).ready(async function() {

	// Add remove buttons to all options
	addRemoveButton();

	// Configure number steppers
	setupNumberSteppers();

	// Update preset menu
	await updatePresetMenu();

	// Populate insert menu with files
	await updateInsertMenu();

	// Update search suggestion
	await updateSearchSuggestion();

	// Download settings
	await downloadSettings();

	// Populate setting options into the select menu
	populateSettingsList();

	// Enable selection menu to activate settings
	showSettingOnSelect();

	// Remove settings on click
	removeSettingOnClick();

	// Listen for insert menu change
	$("#keyword-cloud button").click(insertSelected);

	// Listen for preset menu change
	$("#preset-insert").change(presetSelected);

	// Listen for number stepper
	$("input[step]").change(onNumberChangeWStep);

	// Insert stored data

	// Then URL parameters to override
	const params = getUrlParameters();

	// Decode prompt in case it has special characters in it
	if(params.prompt)
		params.prompt = decodeURIComponent(params.prompt);

	if(params["negative-prompt"])
		params["negative-prompt"] = decodeURIComponent(params["negative-prompt"]);

	// Retrieve useAll and urlOnly from url parameters and ensure removed
	let useAll = (params.useAll == "true");
	let urlOnly = (params.urlOnly == "true");
	delete params.useAll;
	delete params.urlOnly;

	// Settings first

	// Saved state first if allowed
	if(!urlOnly)
		insertSettings(localStorage.getItem('generateSettings'), useAll);

	// Then URL
	insertSettings(params, useAll);

	// Generate
	$("#generate").click(generate);
	$("#random").click(performRandomGenerate);
	$("#share").click(copyShareLink);

	$("input,select,textarea").change(saveState);
	$("button").click(saveState);
});
