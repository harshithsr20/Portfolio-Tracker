from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
try:
    from .database import Base
except (ImportError, ValueError):
    from database import Base
from datetime import datetime

class Fund(Base):
    __tablename__ = "funds"

    id = Column(String, primary_key=True, index=True) # e.g. "hdfc-nifty-50"
    name = Column(String, index=True)
    amc = Column(String)
    category = Column(String)
    isin_or_amfi = Column(String, nullable=True)

    snapshots = relationship("FactSheetSnapshot", back_populates="fund")

class FactSheetSnapshot(Base):
    __tablename__ = "factsheet_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    fund_id = Column(String, ForeignKey("funds.id"))
    month = Column(String) # Format YYYY-MM
    aum = Column(Float, nullable=True)
    ter_direct = Column(Float, nullable=True)
    pdf_file_path = Column(String, nullable=True)
    parsed_data_json = Column(String, nullable=True) # JSON string of full parsed data
    created_at = Column(DateTime, default=datetime.utcnow)

    fund = relationship("Fund", back_populates="snapshots")
    holdings = relationship("Holding", back_populates="snapshot")

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("factsheet_snapshots.id"))
    company_or_instrument_name = Column(String)
    sector = Column(String, nullable=True)
    percentage_weight = Column(Float)

    snapshot = relationship("FactSheetSnapshot", back_populates="holdings")
