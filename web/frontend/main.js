function getUrlParameters() {
  var params = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      params[key] = value;
  });
  return params;
}

function epochToDateString(epochTimestamp) {
  // Create a new JavaScript Date object based on the timestamp
  // multiplied by 1000 so that the argument is in milliseconds, not seconds.
  var date = new Date(epochTimestamp * 1000);

  // Get the month, day, and year
  var month = date.getMonth() + 1; // months are zero indexed
  var day = date.getDate();
  var year = date.getFullYear();

  // Get the hours and minutes
  var hours = date.getHours();
  var minutes = date.getMinutes();

  // Determine AM or PM
  var ampm = hours >= 12 ? 'pm' : 'am';

  // Convert the hours from military time to standard time
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'

  // Add leading zeros if necessary
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;

  // Build the final string
  var dateString = month + '/' + day + '/' + year + ' ' + hours + ':' + minutes + ampm;

  return dateString;
}

function onReindexButton() {
  const backUrl = window.location.href;
  const encodedBackUrl = encodeURIComponent(backUrl);
  const params = new URLSearchParams({ backUrl: encodedBackUrl });
  window.location = `/re-index?${params}`;
}

function _reindexHome() {
  window.location = `/re-index`;
}

function reindexHome() {
  setTimeout(_reindexHome, 500);
}

function _displayProgress(noBack, isUpscale) {

  const progressUrl = (isUpscale) ? "/upscale-progress" : "/progress";

  if(noBack) {
    window.location = progressUrl;
    return;
  }

  const backUrl = window.location.href;
  const encodedBackUrl = encodeURIComponent(backUrl);
  const params = new URLSearchParams({ backUrl: encodedBackUrl });
  window.location = `${progressUrl}?${params}`;
}

// Give the request time to send
// For some reason, jquery offers no way to localy determine when the request is sent
function displayProgress(noBack, isUpscale) {
  setTimeout(_displayProgress.bind(undefined, noBack, isUpscale), 500);
}

async function ajaxGet(path) {
  try {
    const response = await fetch(path);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
  }

  return null;
}

$(document).ready(function() {
    $("#reindex-button").click(onReindexButton);
});
