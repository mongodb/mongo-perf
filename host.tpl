<!doctype html>
<html lang="us">
<head>
	<meta charset="utf-8">
	<title>MongoDB Performance Benchmarks</title>
	<link href="static/css/pepper-grinder/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
	<link href="static/css/style.css" rel="stylesheet">
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
<h1>MongoDB Benchmark Host</h1>
</body>
</html>