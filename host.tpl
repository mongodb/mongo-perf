<!doctype html>
<html lang="us">
<head>
	<meta charset="utf-8">
	<title>MongoDB Performance Benchmarks</title>
	<link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
	<link href="static/css/perf_style.css" rel="stylesheet">
	%import json, datetime
	%host = json.dumps(host, default=lambda obj:obj.isoformat() if isinstance(obj, datetime.datetime) else None)
	<script>
		window.onload = function () {
			(function () {
				document.body.appendChild(document.createElement('pre')).innerHTML = JSON.stringify({{host}}, undefined, 4);
			}());
		};
	</script>
</head> 

<body>
<h1>MongoDB Benchmark Host</h1>
</body>
</html>