function getUrlParameters() {
  var params = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      params[key] = value;
  });
  return params;
}
