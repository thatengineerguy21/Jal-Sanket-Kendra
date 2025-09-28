import io


def test_upload_csv_success(client):
    """
    Tests successful upload and processing of a CSV file.
    """
    csv_content = (
        "latitude,longitude,arsenic,cadmium,lead,zinc\n"
        "28.7,77.1,15.0,4.0,12.0,5500\n"
        "19.0,72.8,5.0,1.0,4.0,2000"
    )
    file = io.BytesIO(csv_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.csv", file, "text/csv")}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["latitude"] == 28.7
    assert data[1]["result"]["hpi_category"] == "Low pollution"


def test_upload_json_success(client):
    """
    Tests successful upload and processing of a JSON file.
    """
    json_content = """
    [
        {
            "latitude": 28.7, "longitude": 77.1,
            "arsenic": 15.0, "cadmium": 4.0, "lead": 12.0, "zinc": 5500
        }
    ]
    """
    file = io.BytesIO(json_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.json", file, "application/json")}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["result"]["hpi_category"] == "Moderate pollution"


def test_upload_missing_column_error(client):
    """
    Tests that a 400 error is returned if a required column is missing.
    """
    csv_content = "latitude,longitude,arsenic,cadmium,lead\n28.7,77.1,15.0,4.0,12.0"  # Missing 'zinc'
    file = io.BytesIO(csv_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test_bad.csv", file, "text/csv")}
    )

    assert response.status_code == 400
    assert "Missing required columns" in response.json()["detail"]


def test_upload_unsupported_file_type(client):
    """
    Tests that a 415 error is returned for an unsupported file type.
    """
    txt_content = "this is not a valid file"
    file = io.BytesIO(txt_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.txt", file, "text/plain")}
    )

    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]
