<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"> 
<html> 
<head> 
<title>Host Information</title> 
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" > 
%import json
%del details['_id']
%del details['platform']['system']['currentTime']
%prettied = json.dumps(details, sort_keys=True,indent=4, separators=(',', ': '))
<script>
window.onload = function () {
    (function () {
    document.body.appendChild(document.createElement('pre')).innerHTML = JSON.stringify({{prettied}}, undefined, 4);
    }());
};
</script>
</head> 

<body>
<h1>MongoDB Benchmark Host Information</h1>
</body>
</html>