package syncengine

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/lib/pq"
)

// tableNamePattern is the shape of every table name this engine will read.
// source_tables values come from the pipelines table, but they end up inside a
// SQL identifier, so they are validated and quoted rather than trusted.
var tableNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// exportResult is what one pipeline run moved.
type exportResult struct {
	rows  int64
	bytes int64
	keys  []string
}

// exportPipeline copies every source table of one pipeline to the destination
// bucket as CSV. Object key contract (also relied on by the UI's copy):
// <destination_prefix><table>/<run start, RFC3339 UTC>-run<id>.csv
func (e *Engine) exportPipeline(ctx context.Context, p Pipeline, runID int64, startedAt time.Time) (exportResult, error) {
	var res exportResult
	stamp := startedAt.UTC().Format(time.RFC3339)

	for _, table := range p.SourceTables {
		if !tableNamePattern.MatchString(table) {
			return res, fmt.Errorf("refusing to export table %q: not a plain lowercase identifier", table)
		}

		data, rowCount, err := tableToCSV(ctx, e.store.db, table)
		if err != nil {
			return res, fmt.Errorf("unable to read table %s: %w", table, err)
		}

		key := fmt.Sprintf("%s%s/%s-run%d.csv", p.DestinationPrefix, table, stamp, runID)
		if err := e.uploader.put(ctx, key, data); err != nil {
			return res, err
		}

		res.rows += rowCount
		res.bytes += int64(len(data))
		res.keys = append(res.keys, key)
	}
	return res, nil
}

// tableToCSV reads a whole table into CSV with a header row of the column
// names. Tables here are demo-sized; buffering one in memory keeps the S3
// write a single PutObject.
func tableToCSV(ctx context.Context, db *sql.DB, table string) ([]byte, int64, error) {
	rows, err := db.QueryContext(ctx,
		fmt.Sprintf(`SELECT * FROM %s ORDER BY 1`, pq.QuoteIdentifier(table)))
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, 0, err
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	if err := w.Write(columns); err != nil {
		return nil, 0, err
	}

	values := make([]any, len(columns))
	pointers := make([]any, len(columns))
	for i := range values {
		pointers[i] = &values[i]
	}

	record := make([]string, len(columns))
	var count int64
	for rows.Next() {
		if err := rows.Scan(pointers...); err != nil {
			return nil, 0, err
		}
		for i, v := range values {
			record[i] = fieldToString(v)
		}
		if err := w.Write(record); err != nil {
			return nil, 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, 0, err
	}
	return buf.Bytes(), count, nil
}

// fieldToString renders one scanned value for CSV. NULL becomes the empty
// string; timestamps become RFC3339 so the objects sort and parse the same way
// the object keys do.
func fieldToString(v any) string {
	switch value := v.(type) {
	case nil:
		return ""
	case []byte:
		return string(value)
	case string:
		return value
	case time.Time:
		return value.UTC().Format(time.RFC3339)
	case int64:
		return strconv.FormatInt(value, 10)
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(value)
	default:
		return fmt.Sprint(value)
	}
}
