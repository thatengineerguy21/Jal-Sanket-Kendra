import io
import time


def test_upload_csv_success(client, db_session):
    csv_content = (
        "village_code,state,district,location,year,coordinates.coordinates[0],coordinates.coordinates[1],parameters.pH,parameters.EC,parameters.CO3,parameters.HCO3,parameters.Cl,parameters.F,parameters.SO4,parameters.NO3,parameters.total_hardness,parameters.Ca,parameters.Mg,parameters.Na,parameters.K,parameters.Fe,parameters.U,parameters.As,source\n"
        "V1,S1,D1,L1,2023,77.1,28.7,7.0,1.0,0,0,0,0,0,0,0,0,0,0,0,0.1,0.01,0.001,lab_A\n"
        "V2,S2,D2,L2,2023,72.8,19.0,7.2,1.0,0,0,0,0,0,0,0,0,0,0,0,0.2,0.02,0.002,lab_B\n"
    )
    file = io.BytesIO(csv_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.csv", file, "text/csv")}
    )

    # Upload now returns 202 Accepted with a task_id
    assert response.status_code == 202
    data = response.json()
    assert "task_id" in data
    assert data["status"] == "pending"
    assert "poll_url" in data

    # Wait for background thread to finish processing
    task_id = data["task_id"]
    for _ in range(20):
        poll = client.get(f"/api/v1/tasks/{task_id}")
        assert poll.status_code == 200
        status = poll.json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(0.25)

    assert status["status"] == "completed"
    assert status["result"]["rows_processed"] == 2
    assert status["result"]["rows_inserted"] == 2


def test_upload_json_success(client, db_session):
    json_content = """
    [
        {
            "village_code": "V1", "state": "S1", "district": "D1", "location": "L1", "year": 2023,
            "coordinates.coordinates[0]": 77.1, "coordinates.coordinates[1]": 28.7,
            "parameters.pH": 7.0, "parameters.EC": 1.0, "parameters.CO3": 0, "parameters.HCO3": 0,
            "parameters.Cl": 0, "parameters.F": 0, "parameters.SO4": 0, "parameters.NO3": 0,
            "parameters.total_hardness": 0, "parameters.Ca": 0, "parameters.Mg": 0, "parameters.Na": 0,
            "parameters.K": 0, "parameters.Fe": 0.1, "parameters.U": 0.01, "parameters.As": 0.001,
            "source": "lab_A"
        }
    ]
    """
    file = io.BytesIO(json_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.json", file, "application/json")}
    )

    assert response.status_code == 202
    data = response.json()
    assert "task_id" in data

    # Wait for background processing
    task_id = data["task_id"]
    for _ in range(20):
        poll = client.get(f"/api/v1/tasks/{task_id}")
        status = poll.json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(0.25)

    assert status["status"] == "completed"
    assert status["result"]["rows_processed"] == 1
    assert status["result"]["rows_inserted"] == 1


def test_upload_missing_column_error(client):
    csv_content = "latitude,longitude\n28.7,77.1"
    file = io.BytesIO(csv_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test_bad.csv", file, "text/csv")}
    )

    assert response.status_code == 400
    assert "Could not find any recognizable location" in response.json()["detail"]


def test_upload_unsupported_file_type(client):
    txt_content = "this is not a valid file"
    file = io.BytesIO(txt_content.encode('utf-8'))

    response = client.post(
        "/api/v1/upload-and-calculate/",
        files={"file": ("test.txt", file, "text/plain")}
    )

    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_task_not_found(client):
    response = client.get("/api/v1/tasks/nonexistent-id")
    assert response.status_code == 404


def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_indices_empty_db(client):
    response = client.get("/api/v1/indices/")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
