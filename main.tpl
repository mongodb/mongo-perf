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
        <li><a href="#labels">Labels</a></li>
        <li><a href="#platforms">Platforms</a></li>
        <li><a href="#versions">Versions</a></li>
        <li><a href="#custom">Custom</a></li>
      </ul>
      <div id="dash">
        Recent Benchmark Tests:
        <ul>
          %if rows:
          %for row in rows:
          <li><a href="results?versions={{row['version']}}&amp;dates={{row['run_date']}}&amp;labels={{row['label']}}&amp;limit=1">
            {{row['label']}} - {{row['platform']}} - {{row['version']}} - {{row['run_date']}}</a>
          </li>
          %end
          %limit=len(rows)
          <li><a href="results?multi={{rows}}&amp;limit={{limit}}">See all</a></li>
          %end
        </ul>
      </div>
      %limit=10
      <div id="labels">
        <ul>
          %for label in labels:
          <li><a href="results?labels={{label}}&amp;versions={{versions[0]}}&amp;limit={{limit}}">{{label}}</a></li>
          %end
        </ul>
      </div>
      <div id="platforms">
        <ul>
          %for platform in platforms:
          <li><a href="results?platforms={{platform}}&amp;versions={{versions[0]}}&amp;limit={{limit}}">{{platform}}</a></li>
          %end
        </ul>
      </div>
      <div id="versions">
        <ul>
          %for version in versions:
          <li><a href="results?versions={{version}}&amp;limit={{limit}}">{{version}}</a></li>
          %end
        </ul>
      </div>
      <div id="custom">
        <form name="custom_form" id="custom_form" action="results" method="get">
          <h2>
          From: <input type="text" size="6" name="start" class="datepicker" readonly="readonly"/>
          <h2>
          To:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="text" size="6" name="end" class="datepicker" readonly="readonly"/>
          <h2>Labels</h2>
          %for label in labels:
          <input type="checkbox" name="labels" value={{label}}>{{label}}<br>
          %end
          <h2>Platforms</h2>
          %for platform in platforms:
          <input type="checkbox" name="platforms" value={{platform}}>{{platform}}<br>
          %end
          <h2>MongoDB Version</h2>
          %for version in versions:
          <input type="checkbox" name="versions" value={{version}}>{{version}}<br>
          %end
          <h2>Limit</h2>
          <input type="text" name="limit" size="2" value="5"/><br><br>
          <button action='submit'>Submit</button>
        </form>
      </div>
    </div>
  </body>
</html>