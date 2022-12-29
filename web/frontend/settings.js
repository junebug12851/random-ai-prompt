// Settings
let settings = {};

// Lists
let lists = []; 

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
	else if($(this).is('textarea'))
		$(this).text(value.join(joinStr));
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
}

function onPlusStepperClick(input) {
	const currentValue = +input.val();
	const step = +input.attr('step');
	input.val(currentValue + step);
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
});
