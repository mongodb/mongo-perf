# Copyright 2013 10gen, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

library("rmongodb")
source("washer.R")

MONGO_PERF_HOST <- "localhost"
MONGO_PERF_PORT <- 27017
cat("Processing benchmark results...\n")

# The 'analysis' collection contains anomaly detection data based on report definitions
# The 'admin' collection will have one record if the indexes have been registered
# The 'raw' collection contains data we want to analyze
host <- paste(MONGO_PERF_HOST, MONGO_PERF_PORT, sep=":")
mongo <- mongo.create(host=host)
if (!mongo.is.connected(mongo))
    error("No connection to MongoDB")

# define the database name and the namespaces of the collections
db <- "bench_results"
analysis <- paste(db, "analysis", sep=".")
raw <- paste(db, "raw", sep=".")
admin <- paste(db, "admin", sep=".")

# performs that data processing phase by calling washer.AV in washer.R
process_data <- function(start_date, end_date, platform, label, version, window, num_db) {
	ensure_index()
	if (match(num_db, "0")) {
		db_id <- "singledb"
		multidb <- FALSE
	} else {
		db_id <- "multidb"
		multidb <- TRUE
	}
	metrics <- get_metrics(db_id)
	threads <- get_threads(db_id)	
	nmetrics <- length(metrics)
	nthreads <- length(threads)
	cat("Pulling records...\n")
	df <- pull_records(start_date, end_date, 
		label, version, nthreads, nmetrics, db_id)
	if (class(df) == "NULL") {
		cat("\nNo data to process. Exiting...\n")
		q(save = "no", status = 1, runLast = FALSE)
	} else {
		for (k in 1:nmetrics) { 
			# select only the current metric
			da <- df[df[,5]==metrics[k],]
			# select only the columns for analysis
			dk <- da[,c('name','run_date','thread_count','value')]
			cat("Running analysis...\n")
			outlier_raw = washer.AV(dk, metrics[k], end_date)
			cat("Writing results...\n")
			# sort by outlier indicator
			outlier_raw <- outlier_raw[order(-outlier_raw[,8]),]
			buf <- mongo.bson.buffer.create()
			mongo.bson.buffer.append.string(buf, "metric", metrics[k])
			mongo.bson.buffer.append.string(buf, "platform", platform)
			mongo.bson.buffer.append.string(buf, "version", version)
			mongo.bson.buffer.append.string(buf, "date", end_date)
			mongo.bson.buffer.append.string(buf, "label", label)
			mongo.bson.buffer.append.bool(buf, "multidb", multidb)
			mongo.bson.buffer.append.int(buf, "window", window)
			mongo.bson.buffer.start.array(buf, "result")
			outlier_raw[,1:3] <- lapply(outlier_raw[,1:3] , as.character)
			for(l in 1:nrow(outlier_raw)) 
				mongo.bson.buffer.append(buf, as.character(l-1), outlier_raw[l,])
			mongo.bson.buffer.finish.object(buf)
			keys <- list(metric=metrics[k], platform=platform, version=version, 
					label=label, window=as.numeric(window), date=end_date)
			criteria <- mongo.bson.from.list(lst=keys)
			obj <- mongo.bson.from.buffer(buf)
			e <- try (
				mongo.update(mongo, analysis, criteria, obj, flags=mongo.update.upsert)
			)
			if (inherits(e, "try-error")) {
				cat("\nNo data to process. Exiting...\n")
				q(save = "no", status = 1, runLast = FALSE)
			}
		}
	}
}

# ensure indexes have been created
ensure_index <- function() {
	indexed = list(indexed=TRUE)
	b <- mongo.find.one(mongo, admin, indexed)
	if (is.null(b)) {
	    mongo.index.create(mongo, analysis, c("version", 
	    "platform", "metric", "label", "date", "window"), mongo.index.unique)
	    mongo.index.create(mongo, analysis, "platform")
	    mongo.index.create(mongo, analysis, "version")
	    mongo.index.create(mongo, analysis, "metric")
	    mongo.index.create(mongo, analysis, "result")
	    mongo.index.create(mongo, analysis, "label")
	    mongo.index.create(mongo, analysis, "date")
	    mongo.insert(mongo, admin, indexed)
	}
}

# select metrics for analysis
get_metrics <- function(multidb) {
	res <- NULL
	record <- mongo.find.one(mongo, raw)
    if (is.null(record)) {
        cat("No records to process!\n")
    } else {
    	benchmarks <- mongo.bson.value(record, multidb)
		return (names(benchmarks[[1]][['results']][[1]]))
	}
}

# select threads for analysis
get_threads <- function(multidb) {
	res <- NULL
	record <- mongo.find.one(mongo, raw)
    if (is.null(record)) {
        cat("No records to process!\n")
    } else {
    	benchmarks <- mongo.bson.value(record, multidb)
		return (names(benchmarks[[1]][['results']]))
	}
}

# select records for analysis
pull_records <- function(start_date, end_date, label, version, nthreads, nmetrics, db_id) {
	df <- NULL
	test_name_sort <- mongo.bson.from.list(list(name=1L))
	buf <- mongo.bson.buffer.create()
    mongo.bson.buffer.start.object(buf, "label")
    mongo.bson.buffer.append(buf, "$regex", paste(label, "$", sep=""))
    mongo.bson.buffer.append(buf, "$options", "i")
    mongo.bson.buffer.finish.object(buf)
    mongo.bson.buffer.start.object(buf, "run_date")
    mongo.bson.buffer.append(buf, "$gte", start_date)
    mongo.bson.buffer.append(buf, "$lte", end_date)
    mongo.bson.buffer.finish.object(buf)
    mongo.bson.buffer.append.string(buf, "version", version)
    query <- mongo.bson.from.buffer(buf)
    count <- mongo.count(mongo, raw, query)
    cursor <- mongo.find(mongo, raw, query, test_name_sort)
    if (is.null(cursor)) {
        cat("Pulled no records to process!\n")
        break
    } else {
		thread_count <- vector("character")
		run_date <- vector("character")
		metric <- vector("character")
		label <- vector("character")
		name <- vector("character")
		value <- vector("numeric")
		metrics <- get_metrics(db_id)
		threads <- get_threads(db_id)	
		nmetrics <- length(metrics)
		nthreads <- length(threads)
    	while (mongo.cursor.next(cursor)) {
			record <- mongo.cursor.value(cursor)
			benchmarks <- mongo.bson.value(record, db_id)
			run_date <- mongo.bson.value(record, "run_date")
			label <- mongo.bson.value(record, "label")
			for (benchmark in names(benchmarks)) {
				name <- benchmarks[[benchmark]][["name"]]
				for(thread in names(benchmarks[[benchmark]][["results"]])) {
					for(test in names(benchmarks[[benchmark]][["results"]][[thread]])) {
						value <- benchmarks[[benchmark]][["results"]][[thread]][[test]]
						en <- data.frame(name=name, run_date=run_date, 
							label=label, thread_count=thread, 
							metric=test, value=value)
						df <- rbind(df, en)
					}
				}
			}
		}
	}
	return (df)
}

options <- commandArgs(trailingOnly = TRUE)

if (length(options) != 7) {
	cat("Requires exactly 7 options!\n")
	cat("Rscript mongo-perf.R start_date end_date",
		"label platform version window multidb\n")
} else {
	do.call(process_data, 
		list(start_date=options[1], end_date=options[2],
			label=options[3], platform=options[4], 
			version=options[5], window=options[6], num_db=options[7]))
}

