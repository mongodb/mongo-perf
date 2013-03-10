<!doctype html>
<html lang="us">
<head>
  <meta charset="utf-8">
  <title>MongoDB Performance Benchmarks</title>
  <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
  <link href="static/css/perf_style.css" rel="stylesheet">
  <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
  <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
  <script type="text/javascript" src="static/js/perf_lib.js"></script>
</head>

<body>
  <h1>MongoDB Performance Benchmarks</h1>
 <div id="tabs">
  <ul>
    <li><a href="#dash">Dashboard</a></li>         
    <li><a href="#platforms">Platforms</a></li>
    <li><a href="#versions">Versions</a></li>
    <li><a href="#custom">Custom</a></li>
  </ul>
  <div id="dash">Recent Benchmark Tests:
    <ul>
      %recent_labels = set()
      %recent_dates = set()
      %recent_versions = set()
      %if rows:
      %for row in rows:
      %recent_labels.add(row['label'])
      %recent_dates.add(row['run_date'])
      %recent_versions.add(row['version'])
      <li><a href="results?versions=/{{row['version']}}/&amp;dates=/{{row['run_date']}}/&amp;labels=/{{row['label']}}$/">
        {{row['label']}} - {{row['platform']}} - {{row['version']}} - {{row['run_date']}}</a></li>
      %end
      <li><a href="results?versions=/{{"|".join(recent_versions)}}/&amp;dates=/{{"|".join(recent_dates)}}/&amp;labels=/{{"|".join(recent_labels)}}/"s>See all</a></li>
      %else:
      %pass
      %end
    </ul>
  </div>

  <div id="platforms">
    <ul>
      %for platform in platforms:
      <li><a href="results?platforms={{platform}}">{{platform}}</a></li>
      %end
    </ul>
  </div>

  <div id="versions">
    <ul>
        %for version in versions:
          <li><a href="results?versions={{version}}">{{version}}</a></li>
        %end
    </ul>
  </div>

  <div id="custom">
    <form name="custom_form" id="custom_form" action="results" method="get">
      <h2>From: <input type="text" size="6" name="start" class="datepicker"/>
      <h2>To:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="text" size="6" name="end" class="datepicker"/>
      <h2>Platforms</h2>
      %for platform in platforms:
      <input type="checkbox" name="platforms" value={{platform}}>{{platform}}<br>
      %end
      <h2>MongoDB Version</h2>
      %for version in versions:
      <input type="checkbox" name="versions" value={{version}}>{{version}}<br>
      %end
      <h2>Limit</h2>
      <input type="text" name="limit" size="2" value="5"/><br>

    <button action='submit'>Submit</button>
    </form>
  </div>

</div>
</body>
</html>
