let name = "";
let imageData = {};

function onPromptSelectionChange() {
    var selectedOption = $(this).val();

    if(selectedOption == "prompt")
        $('#keywords').text(imageData.prompt);
    else if(selectedOption == "negative")
        $('#keywords').text(imageData.negative_prompt);
    else if(selectedOption == "data")
        $('#keywords').text(JSON.stringify(imageData, null, 4));
    else if(selectedOption == "original")
        $('#keywords').text(imageData.origPrompt);
    else if(selectedOption == "post")
        $('#keywords').text(imageData.origPostPrompt);
    else if(selectedOption == "cmd")
        $('#keywords').text(imageData.cmd);

    if(selectedOption == "negative" || selectedOption == "cmd" || selectedOption == "data") {
        $("#generate-this").hide();
    }
    else {
        $("#generate-this").show();
    }
}

function completePage() {

    // Fill in prompt selection
    if(imageData.origPrompt)
        $('#prompt-selection').append('<option value="original">Original Prompt</option>');

    if(imageData.origPostPrompt)
        $('#prompt-selection').append('<option value="post">Post Prompt</option>');

    if(imageData.cmd)
        $('#prompt-selection').append('<option value="cmd">Command</option>');

    // Fill-in default keywords
    $('#keywords').text(imageData.prompt);

    // Add timestamp
    let timestampReadable = "";

    if((typeof imageData.job_timestamp) == "number")
        timestampReadable = epochToDateString(imageData.job_timestamp);
    else {
        const timestamp = imageData.job_timestamp;
        const year = timestamp.substr(0, 4);
        const month = timestamp.substr(4, 2);
        const day = timestamp.substr(6, 2);
        let hour = timestamp.substr(8, 2);
        let isPm = false;
        if(hour > 12) {
            hour -= 12;
            isPm = true;
        }

        const minute = timestamp.substr(10, 2);
        isPm = (isPm) ? "pm" : "am";

        timestampReadable = `${month}/${day}/${year} ${hour}:${minute}${isPm}`;
    }

    $("#timestamp-cell").text(timestampReadable);

    if(imageData.variationOf != undefined)
        $("#parent").show();

    if(imageData.variationOf != undefined)
        $("#type-cell").text("Variation Image");
    else if(imageData.upscaleOf != undefined)
        $("#type-cell").text("Upscaled Image");
    else if(imageData.upscaleOf == undefined && imageData.isUpscale == true)
        $("#type-cell").text("Upscaled Replacing Base");
    else
        $("#type-cell").text("Base Image");

    $("#model-cell").text(imageData.sd_model_hash);
    $("#seed-cell").text(imageData.seed);

    // Enable Variation Options if this is a variation image
    if(imageData.subseed_strength > 0 || imageData.variationOf != undefined) {
        $("#variation-seed-row").show();
        $("#variation-amount-row").show();

        $("#variation-seed-cell").text(imageData.subseed);
        $("#variation-amount-cell").text(+(imageData.subseed_strength * 100).toFixed(2) + "%");
    }

    $("#size-cell").text(`${imageData.width}x${imageData.height}`);

    // If we have a specifically set seed size different from the image size
    // Then show it here
    if((imageData.seed_resize_from_w > -1 && imageData.seed_resize_from_w != imageData.width) ||
        (imageData.seed_resize_from_h > -1 && imageData.seed_resize_from_h != imageData.height)) {

        $("#seed-size-row").show();

        const seedWidth = (imageData.seed_resize_from_w > -1) ? imageData.seed_resize_from_w : imageData.width;
        const seedHeight = (imageData.seed_resize_from_h > -1) ? imageData.seed_resize_from_h : imageData.height;

        $("#seed-size-cell").text(`${seedWidth}x${seedHeight}`);
    }

    if(imageData.upscaleWidth != undefined || imageData.upscaleHeight != undefined) {
        $("#upscale-size-row").show();
        $("#upscale-size-cell").text(`${imageData.upscaleWidth}x${imageData.upscaleHeight}`);
    }

    $("#sampler-cell").text(imageData.sampler_name);
    $("#cfg-cell").text(+imageData.cfg_scale.toFixed(2));
    $("#steps-cell").text(imageData.steps);

    const restoreFaces = (imageData.restore_faces) ? "Yes" : "No"
    const restoreFacesModel = (imageData.face_restoration_model == null || imageData.face_restoration_model == "None") ? "" : ` (${imageData.face_restoration_model})`;

    $("#restore-faces-cell").text(`${restoreFaces}${restoreFacesModel}`);

    const highResFix = (imageData.width > 512 || imageData.height > 512) ? true : false;

    if(highResFix) {
        $("#denoise-row").show();
        $("#denoising-cell").text(+(imageData.denoising_strength * 100).toFixed(2) + "%");
    }

    $("#filename-cell").text(imageData.name);
    $("#data-file-cell").text(imageData.dataPath);
    $("#image-file-cell").text(imageData.imgPath);

    for(let i = 0; i < imageData.keywordCloud.length; i++) {

        // Get keyword
        const keyword = imageData.keywordCloud[i];

        // Dynamic size fluctuates in pixels
        // Between 13-28 pixels
        const dynamicSize = keyword.percent * 15;
        const size = dynamicSize + 13;

        $("#keyword-cloud").append(`
            <li><a href="/?search=${keyword.keyword}" style="font-size: ${size}px" title="${keyword.count}">${keyword.keyword}</a></li>
        `);
    }
}

function loadData() {
    $.ajax({
        type: 'GET',
        url: `/api/images/single/${name}`,
        success: function(data) {
            imageData = data;
            completePage();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function randomName() {
    $.ajax({
        type: 'GET',
        url: '/api/images/random-name',
        success: function(data) {
            name = data;
            loadData();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function generatePrompt(prompt) {
    $.ajax({
        type: 'GET',
        url: `/api/generate/${prompt}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function makeVariations() {
    $.ajax({
        type: 'GET',
        url: `/api/file-variation/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function upscaleFile() {
    $.ajax({
        type: 'GET',
        url: `/api/upscale-file/${imageData.name}`,
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function onGenerateThis() {
    generatePrompt($('#keywords').text());
}

function copyPrompt() {
    const text = $('#keywords').text();

    const tempInput = $('<input>');
    $('body').append(tempInput);
    tempInput.val(text).select();
    document.execCommand('copy');
    tempInput.remove();
};

$(document).ready(function() {
    const params = getUrlParameters();
    const _name = params.name;

    if(name == undefined)
        randomName();
    else {
        name = _name;
        loadData();
    }

    $('#prompt-selection').change(onPromptSelectionChange);
    $('#generate-this').click(onGenerateThis);
    $('#copy').click(copyPrompt);
    $("#make-variations").click(makeVariations);
    $("#make-upscale").click(upscaleFile);
    $("#download").click(() => {
        window.location = `/api/download-file/${imageData.name}`;
    });
    $("#parent").click(() => {
        window.location = `/single?name=${imageData.variationOf}`;
    });
});
