// Settings
let settings = {};

// Lists
let lists = []; 

let settingsQueue = [];
let settingsQueueOngoing = false;

async function saveSettings() {

	// Don't do anything if ongoing
	if(settingsQueueOngoing)
		return;

	// Mark on-going
	settingsQueueOngoing = true;

	// Clone settings queue
	const _settingsQueue = _.cloneDeep(settingsQueue);
	settingsQueue = [];

	try {

		// Save settings one-by-one
		for(let i = 0; i < _settingsQueue.length; i++) {
			await fetch(`/api/setting`, {
			  method: 'POST',
			  body: JSON.stringify({
			  	path: _settingsQueue[i].path,
			    value: _settingsQueue[i].value
			  }),
			  headers: {
			    'Content-Type': 'application/json'
			  }
			});
		}
	}
	catch(err) {
		console.log("Error:");
        console.log(err);
	}

	// Mark false
	settingsQueueOngoing = false;

	// If the queue has items in it again, restart queue
	if(settingsQueue.length > 0)
		setTimeout(saveSettings, 1);
}

function saveSetting(path, value) {
	settingsQueue.push({path,value});
	saveSettings();
}

function returnValToSetting() {

	// Ignore if invalid
	if($(this).is(":invalid"))
		return;

	// Get path(s)
	const paths = $(this).data('path').split(",");

	// Get the value
	let val;

	if($(this).is('[type="checkbox"]'))
		val = $(this).prop('checked').toString();
	// else if($(this).is('textarea'))
	// 	val = $(this).text();
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

function setValToSetting() {
	const path = $(this).data('path').split(",");

	let value = _.at(settings, path);

	if(value == null || value == undefined || value.length == 0)
		return;

	if($(this).data('percent') != undefined) {
		for(let i = 0; i < value.length; i++) {
			value[i] = (+(value[i] * 100).toFixed(2)) + "%";
		}
	}

	let joinStr = "-";

	if($(this).data('join') != undefined) {
		joinStr = $(this).data('join');

		for(let i = 0; i < value.length; i++) {
			if(Array.isArray(value[i]))
				value[i] = value[i].join(joinStr);
		}
	}

	// console.log(path, value);

	if($(this).is('[type="checkbox"]'))
		$(this).prop('checked', value[0]);
	// else if($(this).is('textarea'))
	// 	$(this).text(value.join(joinStr));
	else
		$(this).val(value.join(joinStr));
}

function onSettingsDownload() {
	$('select[data-lists]').each(function() {
		for(let i = 0; i < lists.length; i++) {
			let display = _.startCase(lists[i]);
			if(display == "False")
				display = "Random";

			$(this).append(`<option value="${lists[i]}">${display}</option>`);
		}
	});

	$('[data-path]').each(setValToSetting);
}

function downloadLists() {
	$.ajax({
        type: 'GET',
        url: `/api/files/lists`,
        success: function(data) {
            lists = ["false", ...data];
            onSettingsDownload();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function downloadSettings() {
	$.ajax({
        type: 'GET',
        url: `/api/settings`,
        success: function(data) {
            settings = data;
            downloadLists();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function onPageButtonClick() {
	const target = $(this).attr("data-page");

	$(".content").hide();
	$("#sections button").removeClass("active");
	$(this).addClass("active");

	$("#" + target).show();
};

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

$(document).ready(function() {
	setupNumberSteppers();
	downloadSettings();
	$("#sections button").click(onPageButtonClick);
	$("input[step]").change(onNumberChangeWStep);
	$('[data-path]').change(returnValToSetting);
});
